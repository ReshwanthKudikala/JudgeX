#!/usr/bin/env node
/**
 * Smoke: shared project workspace must compile, be executable, and run ./main.
 * Run: docker exec judgex-prod-worker node /app/scripts/smoke-workspace-bind.js
 */
const docker = require('../src/infrastructure/docker/docker.adapter');

async function main() {
  const sandbox = await docker.createSandbox({ image: 'judgex-cpp', memoryMb: 256 });
  try {
    await docker.copyFiles(sandbox, [
      {
        path: 'main.cpp',
        content: '#include <iostream>\nint main(){ std::cout << 42; return 0; }\n',
      },
    ]);
    await docker.assertWorkspaceFile(sandbox, 'main.cpp');

    const compile = await docker.executeCommand(sandbox, {
      cmd: ['g++', '-std=c++17', '-O2', '-o', 'main', 'main.cpp'],
      timeoutMs: 10000,
    });
    if (compile.exitCode !== 0) {
      console.error('COMPILE_FAIL', compile.stderr || compile.stdout);
      process.exit(1);
    }

    const mount = await docker.executeCommand(sandbox, {
      cmd: ['sh', '-c', 'cat /proc/mounts | grep " /workspace "'],
      timeoutMs: 3000,
    });
    const mountLine = (mount.stdout || '').trim();
    if (!mountLine) {
      console.error('MOUNT_MISSING');
      process.exit(1);
    }
    if (/\bnoexec\b/.test(mountLine)) {
      console.error('MOUNT_NOEXEC', mountLine);
      process.exit(1);
    }

    const run = await docker.executeCommand(sandbox, {
      cmd: ['./main'],
      timeoutMs: 3000,
    });
    if (run.exitCode !== 0 || String(run.stdout).trim() !== '42') {
      console.error('RUN_FAIL', JSON.stringify(run));
      process.exit(1);
    }

    console.log(
      JSON.stringify({
        ok: true,
        hostDir: sandbox.hostDir,
        bindSource: sandbox.bindSource,
        workspaceDir: process.env.JUDGE_WORKSPACE_DIR || null,
        workspaceHostDir: process.env.JUDGE_WORKSPACE_HOST_DIR || null,
        mount: mountLine,
        stdout: String(run.stdout).trim(),
      }),
    );
  } finally {
    await docker.cleanup(sandbox);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
