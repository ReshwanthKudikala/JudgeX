// Compile stage: builds source inside a sandbox via the Docker adapter.
//
// SCOPE: this module only *prepares* code for execution and reports the raw
// outcome of that preparation. It never runs the user's program, compares
// output, or decides a verdict. Mapping a compile failure to `Compilation Error`
// is the verdict generator's job (JUDGE_PIPELINE.md §5) — here we only say
// whether preparation succeeded and hand back stdout/stderr/exit/duration.

const { executeCommand } = require('../../infrastructure/docker/docker.adapter');
const { logger } = require('../../shared/logger/logger');
const { JudgeError } = require('../../shared/errors/domain-errors');

// Source filenames the sandbox workspace is expected to contain (placed there by
// the pipeline via the Docker adapter's copyFiles before this stage runs).
const SOURCE_FILES = Object.freeze({ cpp: 'main.cpp', python: 'main.py' });

// Compiled C++ artifact name (in the workspace workdir).
const CPP_OUTPUT = 'main';

// Compilation gets its own (generous) time budget, separate from the per-test
// execution timeout. A stuck/adversarial compile is force-killed by the adapter.
const DEFAULT_COMPILE_TIMEOUT_MS = 10000;

// Build a uniform compile-result object. Deliberately verdict-free.
function toResult({ language, exec }) {
  return {
    language,
    success: exec.exitCode === 0 && !exec.timedOut,
    stdout: exec.stdout,
    stderr: exec.stderr,
    exitCode: exec.exitCode,
    timedOut: exec.timedOut,
    durationMs: exec.durationMs,
  };
}

/**
 * Compile main.cpp with g++ inside the sandbox.
 * Assumes the source is already present in the workspace.
 *
 * @param {object} sandbox - handle from dockerAdapter.createSandbox.
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] - compile time budget.
 * @param {string} [opts.std] - C++ standard (default c++17).
 * @returns {Promise<object>} compile result (no verdict).
 */
async function compileCpp(sandbox, { timeoutMs, std = 'c++17' } = {}) {
  const exec = await executeCommand(sandbox, {
    cmd: ['g++', `-std=${std}`, '-O2', '-o', CPP_OUTPUT, SOURCE_FILES.cpp],
    timeoutMs: timeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS,
  });

  const result = toResult({ language: 'cpp', exec });
  logger.info('C++ compile finished', {
    success: result.success,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
  });
  return result;
}

/**
 * Validate Python syntax WITHOUT executing user code, via `py_compile`.
 * py_compile byte-compiles the source (parses + checks syntax) but does not run
 * the module's top-level statements.
 *
 * @param {object} sandbox - handle from dockerAdapter.createSandbox.
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] - validation time budget.
 * @returns {Promise<object>} compile result (no verdict).
 */
async function preparePython(sandbox, { timeoutMs } = {}) {
  const exec = await executeCommand(sandbox, {
    cmd: ['python3', '-m', 'py_compile', SOURCE_FILES.python],
    timeoutMs: timeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS,
  });

  const result = toResult({ language: 'python', exec });
  logger.info('Python syntax check finished', {
    success: result.success,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
  });
  return result;
}

/**
 * Dispatch to the correct preparation strategy for the language.
 *
 * @param {string} language - 'cpp' | 'python'.
 * @param {object} sandbox - handle from dockerAdapter.createSandbox.
 * @param {object} [opts] - passed through to the language implementation.
 * @returns {Promise<object>} compile result (no verdict).
 * @throws {JudgeError} for an unsupported language.
 */
function compile(language, sandbox, opts = {}) {
  switch (language) {
    case 'cpp':
      return compileCpp(sandbox, opts);
    case 'python':
      return preparePython(sandbox, opts);
    default:
      throw new JudgeError(`Unsupported language for compilation: ${language}`);
  }
}

module.exports = { compile, compileCpp, preparePython, SOURCE_FILES, CPP_OUTPUT };
