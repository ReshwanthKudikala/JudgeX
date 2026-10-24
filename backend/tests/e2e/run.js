#!/usr/bin/env node
// Windows-friendly launcher: expands e2e test files for node --test.

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
  console.error('No e2e test files found.');
  process.exit(1);
}

const args = ['--test', '--test-concurrency=1'];
const timeoutMs = process.env.E2E_TEST_TIMEOUT_MS;
if (timeoutMs) {
  if (!/^[1-9]\d*$/.test(timeoutMs)) {
    console.error('E2E_TEST_TIMEOUT_MS must be a positive integer');
    process.exit(1);
  }
  args.push(`--test-timeout=${timeoutMs}`);
}
args.push(...files);

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, EMAIL_PROVIDER: 'console' },
});

process.exit(result.status ?? 1);
