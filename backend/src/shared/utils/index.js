// Pure helper functions (no I/O, no side effects).

const { v7: uuidv7 } = require('uuid');

// Resolves after `ms` milliseconds. Used for spacing out startup retries.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generates a UUID v7 (time-ordered) for use as a primary key.
// Centralized so the whole app shares one ID strategy (DATABASE_DESIGN.md §1.4).
function newId() {
  return uuidv7();
}

// Current wall-clock time as a Date (for parameterized timestamp columns).
function now() {
  return new Date();
}

// Current time as an ISO-8601 string.
function nowIso() {
  return new Date().toISOString();
}

module.exports = { sleep, newId, now, nowIso };
