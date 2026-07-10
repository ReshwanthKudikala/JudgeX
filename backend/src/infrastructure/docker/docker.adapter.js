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

  // Private per-job workspace on the host, bind-mounted into the container.
  // World-writable so the non-root container user can write compile artifacts.
  const hostDir = await fs.mkdtemp(path.join(os.tmpdir(), 'judgex-'));
  await fs.chmod(hostDir, 0o777);

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
        Binds: [`${hostDir}:${containerWorkdir}:rw`],
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

  logger.info('Sandbox created', { containerId: container.id, image });
  return { id: container.id, container, hostDir, workdir: containerWorkdir, user: containerUser };
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
 * @returns {Promise<{stdout:string, stderr:string, exitCode:number|null, timedOut:boolean, durationMs:number}>}
 */
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

  let exec;
  let stream;
  try {
    exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: hasInput,
      WorkingDir: workdir || sandbox.workdir,
      Env: env,
      User: sandbox.user,
    });
    stream = await exec.start({ hijack: hasInput, stdin: hasInput });
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

  if (hasInput) {
    stream.write(input);
    stream.end();
  }

  const startedAt = Date.now();
  let timedOut = false;
  let timer = null;

  const finished = new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  if (limitMs && limitMs > 0) {
    timer = setTimeout(async () => {
      timedOut = true;
      // Untrusted code cannot be trusted to stop itself — kill the container.
      try {
        await container.kill({ signal: 'SIGKILL' });
      } catch {
        /* container may already be gone */
      }
    }, limitMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  try {
    await finished;
  } finally {
    if (timer) clearTimeout(timer);
  }

  let exitCode = null;
  try {
    const info = await exec.inspect();
    exitCode = info.ExitCode;
  } catch {
    /* exec metadata unavailable (e.g. container killed) */
  }

  return {
    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: Buffer.concat(stderrChunks).toString('utf8'),
    exitCode,
    timedOut,
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

module.exports = {
  getDocker,
  createSandbox,
  copyFiles,
  executeCommand,
  removeSandbox,
  cleanup,
};
