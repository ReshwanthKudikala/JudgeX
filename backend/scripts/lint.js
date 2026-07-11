#!/usr/bin/env node
/**
 * Lightweight backend lint: syntax-check all application JS sources.
 * Fail-fast on the first parse error (no ESLint dependency required).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['src', 'scripts', 'tests'].map((d) => path.join(ROOT, d));

function collectJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'coverage') continue;
      collectJs(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = TARGETS.flatMap((dir) => collectJs(dir)).sort();
if (files.length === 0) {
  console.error('No JavaScript files found to lint.');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failed += 1;
    const rel = path.relative(ROOT, file);
    process.stderr.write(`FAIL ${rel}\n`);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

if (failed > 0) {
  console.error(`\nLint failed: ${failed}/${files.length} file(s) have syntax errors.`);
  process.exit(1);
}

console.log(`Lint passed: ${files.length} file(s) checked.`);
