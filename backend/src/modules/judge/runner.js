// Run stage: executes the program per test case in a sandbox via the Docker adapter.
//
// SCOPE: this module only *runs* the prepared program against a given stdin and
// reports the raw execution outcome. It never compares output to expected, and
// never decides a verdict. Mapping signals (crash → RE, timeout → TLE, mismatch
// → WA, …) is the verdict generator's job (JUDGE_PIPELINE.md §5); comparison is
// the comparator's job. Here we only capture what happened.

const { executeCommand } = require('../../infrastructure/docker/docker.adapter');
const { logger } = require('../../shared/logger/logger');
const { JudgeError } = require('../../shared/errors/domain-errors');
const { SOURCE_FILES, CPP_OUTPUT } = require('./compiler');

// Argv per language. The C++ binary is the artifact produced by the compile
// stage; Python runs the source directly with the interpreter.
const RUN_COMMANDS = Object.freeze({
  cpp: [`./${CPP_OUTPUT}`],
  python: ['python3', SOURCE_FILES.python],
});

// Build a uniform execution-result object. Deliberately verdict-free.
function toResult(exec) {
  return {
    stdout: exec.stdout,
    stderr: exec.stderr,
    exitCode: exec.exitCode,
    timedOut: exec.timedOut,
    oomKilled: Boolean(exec.oomKilled),
    durationMs: exec.durationMs,
    memoryKb: exec.memoryKb !== undefined ? exec.memoryKb : null,
  };
}

/**
 * Execute one command in the sandbox with the given stdin under a wall-clock
 * timeout. Shared internals for both languages.
 */
async function runCommand(sandbox, cmd, { input, timeoutMs } = {}) {
  const exec = await executeCommand(sandbox, {
    cmd,
    input,
    // Per-test execution budget; the adapter force-kills the container on overrun.
    timeoutMs,
  });
  return toResult(exec);
}

/**
 * Execute the compiled C++ binary (./main) for one test case.
 *
 * @param {object} sandbox - handle from dockerAdapter.createSandbox.
 * @param {object} [opts]
 * @param {string|Buffer} [opts.input] - stdin for this test case.
 * @param {number} [opts.timeoutMs] - per-test execution budget.
 * @returns {Promise<object>} execution result (no verdict).
 */
async function runCpp(sandbox, { input, timeoutMs } = {}) {
  const result = await runCommand(sandbox, RUN_COMMANDS.cpp, { input, timeoutMs });
  logger.info('C++ run finished', {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
  });
  return result;
}

/**
 * Execute the Python program (python3 main.py) for one test case.
 *
 * @param {object} sandbox - handle from dockerAdapter.createSandbox.
 * @param {object} [opts]
 * @param {string|Buffer} [opts.input] - stdin for this test case.
 * @param {number} [opts.timeoutMs] - per-test execution budget.
 * @returns {Promise<object>} execution result (no verdict).
 */
async function runPython(sandbox, { input, timeoutMs } = {}) {
  const result = await runCommand(sandbox, RUN_COMMANDS.python, { input, timeoutMs });
  logger.info('Python run finished', {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
  });
  return result;
}

/**
 * Dispatch to the correct execution strategy for the language.
 *
 * @param {string} language - 'cpp' | 'python'.
 * @param {object} sandbox - handle from dockerAdapter.createSandbox.
 * @param {object} [opts] - { input, timeoutMs }.
 * @returns {Promise<object>} execution result (no verdict).
 * @throws {JudgeError} for an unsupported language.
 */
function run(language, sandbox, opts = {}) {
  switch (language) {
    case 'cpp':
      return runCpp(sandbox, opts);
    case 'python':
      return runPython(sandbox, opts);
    default:
      throw new JudgeError(`Unsupported language for execution: ${language}`);
  }
}

module.exports = { run, runCpp, runPython, RUN_COMMANDS };
