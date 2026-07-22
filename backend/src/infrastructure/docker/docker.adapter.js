// Docker implementation: create, exec with resource limits, and destroy containers.
//
// This is a PURE infrastructure adapter over dockerode. It knows how to create a
// locked-down sandbox container, put files into it, run an arbitrary command in
// it, and tear it down — nothing about compilation, execution semantics, output
// comparison, verdicts, submissions, or BullMQ. The judge pipeline (later) drives
// this adapter; the adapter itself holds no judging logic.
//
// Security model per ARCHITECTURE.md §5 and JUDGE_PIPELINE.md §4/§9:
//   ephemeral · no network · non-root · drop-all-caps · no-new-privileges ·
//   read-only rootfs · memory/CPU/PID limits · isolated per-job workspace ·
//   unconditional cleanup.

const { Writable } = require('stream');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const Docker = require('dockerode');

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { DockerError } = require('../../shared/errors/domain-errors');

// Sandbox defaults (overridable per createSandbox call).
const DEFAULT_WORKDIR = '/workspace';
const DEFAULT_USER = '1000:1000'; // non-root uid:gid
const DEFAULT_CPUS = 1; // whole CPUs → NanoCpus
const DEFAULT_SCRATCH_MB = 64; // size-capped writable /tmp
// Keep-alive command so the locked-down container stays up for exec calls, then
// is destroyed. Must exist in the (minimal) language image.
const KEEPALIVE_CMD = ['tail', '-f', '/dev/null'];

let docker = null;

// Lazily create the dockerode client (defaults to the local daemon socket/pipe).
function getDocker() {
  if (!docker) {
    docker = new Docker();
  }
  return docker;
}

/**
 * Root directory for per-job workspaces. Prefer JUDGE_WORKSPACE_DIR (shared mount
 * visible to the host Docker daemon) over os.tmpdir() so bind mounts work when
 * the worker itself runs inside a container.
 */
function getWorkspaceRoot() {
  return config.judge.workspaceDir || os.tmpdir();
}

/**
 * Map a worker-local workspace path to the path the Docker daemon must bind.
 * When JUDGE_WORKSPACE_HOST_DIR differs from JUDGE_WORKSPACE_DIR (Windows host
 * bind into a Linux container), rewrite the prefix; otherwise return hostDir.
 */
function toDaemonBindPath(hostDir) {
  const workspaceRoot = getWorkspaceRoot();
  const bindRoot = config.judge.workspaceHostDir || workspaceRoot;
  let bindPath = hostDir;
  if (bindRoot !== workspaceRoot) {
    const relative = path.relative(workspaceRoot, hostDir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new DockerError(
        `Sandbox workspace ${hostDir} is outside configured root ${workspaceRoot}`,
      );
    }
    // Manual join: worker often runs on Linux while bindRoot is a Windows host
    // path (Docker Desktop). path.join would mishandle drive letters.
    const root = String(bindRoot).replace(/\\/g, '/').replace(/\/+$/, '');
    const rel = relative.split(path.sep).join('/');
    bindPath = `${root}/${rel}`;
  }
  // Docker Desktop accepts forward-slash host paths.
  return String(bindPath).replace(/\\/g, '/');
}

/**
 * Create and start an isolated, locked-down sandbox container with a private
 * temporary working directory bind-mounted in.
 *
 * @param {object} opts
 * @param {string} opts.image - prebuilt language image (required).
 * @param {number} [opts.memoryMb] - hard memory cap (default config.judge.memoryLimitMb).
 * @param {number} [opts.cpus] - CPU quota in whole CPUs (default 1).
 * @param {number} [opts.pids] - max processes/threads (default config.judge.pidLimit).
 * @param {string} [opts.user] - in-container user (default non-root 1000:1000).
 * @param {string} [opts.workdir] - container working dir (default /workspace).
 * @param {number} [opts.scratchMb] - size cap for the writable /tmp tmpfs.
 * @returns {Promise<{id:string, container:object, hostDir:string, workdir:string, user:string}>}
 */
async function createSandbox({ image, memoryMb, cpus, pids, user, workdir, scratchMb } = {}) {
  if (!image) {
    throw new DockerError('createSandbox requires an image.');
  }

  const client = getDocker();
  const containerWorkdir = workdir || DEFAULT_WORKDIR;
  const containerUser = user || DEFAULT_USER;

  // Private per-job workspace under the shared (daemon-visible) root, then
  // bind-mounted into the sandbox. World-writable so the non-root container
  // user can write compile artifacts.
  const workspaceRoot = getWorkspaceRoot();
  await fs.mkdir(workspaceRoot, { recursive: true });
  const hostDir = await fs.mkdtemp(path.join(workspaceRoot, 'judgex-'));
  await fs.chmod(hostDir, 0o777);
  const bindSource = toDaemonBindPath(hostDir);

  const memoryBytes = (memoryMb ?? config.judge.memoryLimitMb) * 1024 * 1024;
  const nanoCpus = Math.round((cpus ?? DEFAULT_CPUS) * 1e9);
  const pidsLimit = pids ?? config.judge.pidLimit;

  let container;
  try {
    container = await client.createContainer({
      Image: image,
      User: containerUser,
      WorkingDir: containerWorkdir,
      Cmd: KEEPALIVE_CMD,
      Tty: false,
      NetworkDisabled: true, // no networking at the container level…
      HostConfig: {
        NetworkMode: 'none', // …and at the host-config level (belt and suspenders)
        Binds: [`${bindSource}:${containerWorkdir}:rw`],
        Memory: memoryBytes,
        MemorySwap: memoryBytes, // == Memory → disable swap so the cap is hard
        NanoCpus: nanoCpus,
        PidsLimit: pidsLimit, // defeat fork bombs
        CapDrop: ['ALL'], // no Linux capabilities
        SecurityOpt: ['no-new-privileges'], // block setuid escalation
        ReadonlyRootfs: true, // immutable root filesystem
        Tmpfs: { '/tmp': `rw,size=${scratchMb ?? DEFAULT_SCRATCH_MB}m` },
        AutoRemove: false, // we remove explicitly for deterministic cleanup
      },
    });
    await container.start();
  } catch (err) {
    // Best-effort rollback so a failed create never leaks a container or dir.
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        /* ignore */
      }
    }
    await fs.rm(hostDir, { recursive: true, force: true }).catch(() => {});
    throw new DockerError(`Failed to create sandbox: ${err.message}`);
  }

  logger.info('Sandbox created', {
    containerId: container.id,
    image,
    hostDir,
    bindSource,
  });
  return {
    id: container.id,
    container,
    hostDir,
    bindSource,
    workdir: containerWorkdir,
    user: containerUser,
  };
}

/**
 * Write files into the sandbox's bind-mounted workspace (they appear inside the
 * container at its workdir). Does not compile or run anything.
 *
 * @param {object} sandbox - handle from createSandbox.
 * @param {Array<{path:string, content:string|Buffer, mode?:number}>} files
 */
async function copyFiles(sandbox, files = []) {
  if (!sandbox || !sandbox.hostDir) {
    throw new DockerError('copyFiles requires a sandbox with a workspace.');
  }
  for (const file of files) {
    const dest = path.join(sandbox.hostDir, file.path);
    // eslint-disable-next-line no-await-in-loop -- small, sequential file writes.
    await fs.mkdir(path.dirname(dest), { recursive: true });
    // eslint-disable-next-line no-await-in-loop
    await fs.writeFile(dest, file.content, { mode: file.mode ?? 0o644 });
  }
}

/**
 * Integration check: confirm a relative path is visible *inside* the sandbox
 * (catches DinD bind-mount mismatches that host-side fs.writeFile cannot).
 *
 * @param {object} sandbox - handle from createSandbox.
 * @param {string} relativePath - e.g. main.cpp
 */
async function assertWorkspaceFile(sandbox, relativePath) {
  if (!sandbox || !sandbox.container) {
    throw new DockerError('assertWorkspaceFile requires a running sandbox.');
  }
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('..')) {
    throw new DockerError('assertWorkspaceFile requires a safe relative path.');
  }
  const containerPath = path.posix.join(sandbox.workdir || DEFAULT_WORKDIR, relativePath);
  const result = await executeCommand(sandbox, {
    cmd: ['test', '-f', containerPath],
    timeoutMs: 3000,
  });
  if (result.exitCode !== 0) {
    throw new DockerError(
      `Source file missing inside sandbox: expected ${containerPath} (bind may not be host-visible)`,
    );
  }
}

/**
 * Run an arbitrary command inside the sandbox and capture its output. This is a
 * generic mechanism — it does not know or care whether the command compiles or
 * runs user code; the caller decides that. A wall-clock timeout force-kills the
 * container if the command overruns.
 *
 * @param {object} sandbox - handle from createSandbox.
 * @param {object} opts
 * @param {string[]} opts.cmd - argv to execute (required).
 * @param {string|Buffer} [opts.input] - stdin to feed the command.
 * @param {number} [opts.timeoutMs] - wall-clock cap (default config.judge.timeLimitMs).
 * @param {string} [opts.workdir] - override working directory.
 * @param {string[]} [opts.env] - additional environment (["K=V", …]).
 * @returns {Promise<{stdout:string, stderr:string, exitCode:number|null, timedOut:boolean, oomKilled:boolean, durationMs:number}>}
 */
// Single-quote escape for embedding argv into `sh -c` (Alpine ash / bash).
function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Wait until a Docker exec has finished, then return its inspect payload.
 * Polling avoids races where the attach stream ends before ExitCode is set
 * (common with dockerode on Windows / short-lived processes).
 */
async function waitForExecInspect(exec, { timedOutFlag, pollMs = 25 } = {}) {
  for (;;) {
    const info = await exec.inspect();
    if (!info.Running) return info;
    if (timedOutFlag && timedOutFlag.value) {
      // Container kill is in flight; keep polling briefly for a terminal inspect.
      return info;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, pollMs);
    });
  }
}

async function executeCommand(sandbox, { cmd, input, timeoutMs, workdir, env } = {}) {
  if (!sandbox || !sandbox.container) {
    throw new DockerError('executeCommand requires a running sandbox.');
  }
  if (!Array.isArray(cmd) || cmd.length === 0) {
    throw new DockerError('executeCommand requires a non-empty cmd array.');
  }

  const { container } = sandbox;
  const hasInput = input !== undefined && input !== null;
  const limitMs = timeoutMs ?? config.judge.timeLimitMs;

  // Feed stdin via a workspace file + shell redirect. Ending a dockerode hijack
  // duplex after write() closes the *entire* attach stream on some platforms
  // (notably Docker Desktop / Windows), which drops stdout and leaves ExitCode
  // null — every interactive submission then looks like a runtime error.
  let runCmd = cmd;
  if (hasInput) {
    const stdinName = '.judgex_stdin';
    await fs.writeFile(path.join(sandbox.hostDir, stdinName), input);
    const redirected = `${cmd.map(shellSingleQuote).join(' ')} < ${shellSingleQuote(
      path.posix.join(sandbox.workdir, stdinName),
    )}`;
    runCmd = ['sh', '-c', redirected];
  }

  let exec;
  let stream;
  try {
    exec = await container.exec({
      Cmd: runCmd,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: false,
      WorkingDir: workdir || sandbox.workdir,
      Env: env,
      User: sandbox.user,
    });
    stream = await exec.start({ hijack: true, stdin: false });
  } catch (err) {
    throw new DockerError(`Failed to exec in sandbox: ${err.message}`);
  }

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutSink = new Writable({
    write(chunk, _enc, cb) {
      stdoutChunks.push(chunk);
      cb();
    },
  });
  const stderrSink = new Writable({
    write(chunk, _enc, cb) {
      stderrChunks.push(chunk);
      cb();
    },
  });
  container.modem.demuxStream(stream, stdoutSink, stderrSink);

  const startedAt = Date.now();
  const timedOutFlag = { value: false };
  let timer = null;

  if (limitMs && limitMs > 0) {
    timer = setTimeout(async () => {
      timedOutFlag.value = true;
      // Untrusted code cannot be trusted to stop itself — kill the container.
      try {
        await container.kill({ signal: 'SIGKILL' });
      } catch {
        /* container may already be gone */
      }
    }, limitMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  let exitCode = null;
  try {
    const info = await waitForExecInspect(exec, { timedOutFlag });
    exitCode = typeof info.ExitCode === 'number' ? info.ExitCode : null;
  } catch {
    /* exec metadata unavailable (e.g. container killed) */
  } finally {
    if (timer) clearTimeout(timer);
    try {
      stream.destroy();
    } catch {
      /* ignore */
    }
  }

  // OOM is reported on the container state (Memory hard-cap), not the exec inspect.
  let oomKilled = false;
  if (!timedOutFlag.value) {
    try {
      const inspected = await container.inspect();
      oomKilled = Boolean(inspected.State && inspected.State.OOMKilled);
    } catch {
      /* inspect unavailable */
    }
  }

  return {
    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: Buffer.concat(stderrChunks).toString('utf8'),
    exitCode,
    timedOut: timedOutFlag.value,
    oomKilled,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Force-remove the sandbox container. Best-effort and never throws so it is safe
 * to call from a finally block.
 *
 * @param {object} sandbox - handle from createSandbox.
 */
async function removeSandbox(sandbox) {
  if (!sandbox || !sandbox.container) return;
  try {
    await sandbox.container.remove({ force: true });
    logger.info('Sandbox container removed', { containerId: sandbox.id });
  } catch (err) {
    logger.warn('Failed to remove sandbox container', {
      containerId: sandbox.id,
      error: err.message,
    });
  }
}

/**
 * Unconditional teardown: remove the container AND delete the host workspace.
 * The guaranteed cleanup path (call from a finally block); never throws.
 *
 * @param {object} sandbox - handle from createSandbox.
 */
async function cleanup(sandbox) {
  if (!sandbox) return;
  await removeSandbox(sandbox);
  if (sandbox.hostDir) {
    await fs.rm(sandbox.hostDir, { recursive: true, force: true }).catch((err) => {
      logger.warn('Failed to remove sandbox workspace', {
        hostDir: sandbox.hostDir,
        error: err.message,
      });
    });
  }
}

/**
 * Lightweight Docker daemon probe (observability only — not used by judging).
 * @returns {Promise<{ ok: boolean, latencyMs?: number, error?: string }>}
 */
async function checkDockerHealth() {
  const start = Date.now();
  try {
    await getDocker().ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

module.exports = {
  getDocker,
  createSandbox,
  copyFiles,
  assertWorkspaceFile,
  executeCommand,
  removeSandbox,
  cleanup,
  checkDockerHealth,
};
