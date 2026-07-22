// Shared sandbox execution: create → copy source → compile → run cases → cleanup.
//
// SCOPE: verdict-free. No persistence, no comparison, no queue, no HTTP.
// Submit (judge.pipeline) and future Run both call into this module so compile /
// Docker lifecycle is not duplicated.
//
// Dependencies are injectable for unit tests (same pattern as the pipeline).

const dockerAdapter = require('../../infrastructure/docker/docker.adapter');
const compiler = require('./compiler');
const runner = require('./runner');
const { JudgeError } = require('../../shared/errors/domain-errors');

/** Prebuilt sandbox image per language (ARCHITECTURE.md §5.2). */
const LANGUAGE_IMAGES = Object.freeze({
  cpp: 'judgex-cpp',
  python: 'judgex-python',
});

/**
 * Run a worker against a compiled (or compile-failed) sandbox, always cleaning up.
 *
 * @param {object} options
 * @param {string} options.language - 'cpp' | 'python'
 * @param {string} options.sourceCode
 * @param {number} options.memoryMb - container memory limit
 * @param {object} [options.docker]
 * @param {Function} [options.compile]
 * @param {Function} [options.run]
 * @param {object} [options.sourceFiles]
 * @param {object} [options.images]
 * @param {(ctx: {
 *   sandbox: object,
 *   compileResult: object,
 *   runCase: (input: string|Buffer, timeoutMs: number) => Promise<object>,
 * }) => Promise<*>} worker - receives compile result + per-case runner
 * @returns {Promise<*>} whatever `worker` returns
 */
async function withExecution(options, worker) {
  const {
    language,
    sourceCode,
    memoryMb,
    docker = dockerAdapter,
    compile = compiler.compile,
    run = runner.run,
    sourceFiles = compiler.SOURCE_FILES,
    images = LANGUAGE_IMAGES,
  } = options;

  const image = images[language];
  if (!image) {
    throw new JudgeError(`No sandbox image for language: ${language}`);
  }

  const sandbox = await docker.createSandbox({
    image,
    memoryMb,
  });

  try {
    await docker.copyFiles(sandbox, [
      { path: sourceFiles[language], content: sourceCode },
    ]);

    // Source must be visible inside the sandbox (not only on the worker FS)
    // before compile — catches DinD bind-mount failures early.
    const sourceName = sourceFiles[language];
    if (typeof docker.assertWorkspaceFile === 'function') {
      await docker.assertWorkspaceFile(sandbox, sourceName);
    }

    const compileResult = await compile(language, sandbox);

    const runCase = (input, timeoutMs) =>
      run(language, sandbox, { input, timeoutMs });

    return await worker({ sandbox, compileResult, runCase });
  } finally {
    await docker.cleanup(sandbox);
  }
}

module.exports = {
  withExecution,
  LANGUAGE_IMAGES,
};
