// Pure helper functions (no I/O, no side effects).

// Resolves after `ms` milliseconds. Used for spacing out startup retries.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sleep };
