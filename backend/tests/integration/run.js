#!/usr/bin/env node
// Windows-friendly launcher: expands integration test files for node --test.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join(dir, f))
  .sort();

if (files.length === 0) {
  console.error('No integration test files found.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1', ...files],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
