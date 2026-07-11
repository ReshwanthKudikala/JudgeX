#!/usr/bin/env node
// Windows-friendly launcher for unit tests.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function collectTests(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTests(full, acc);
    else if (entry.name.endsWith('.test.js')) acc.push(full);
  }
  return acc;
}

const root = path.join(__dirname);
const files = collectTests(root).sort();

if (files.length === 0) {
  console.error('No unit test files found.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1', ...files],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
