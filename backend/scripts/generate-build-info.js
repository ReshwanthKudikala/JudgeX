#!/usr/bin/env node
/**
 * Emit build metadata as shell exports / JSON for Docker & release automation.
 *
 * Usage:
 *   node scripts/generate-build-info.js
 *   eval "$(node scripts/generate-build-info.js --export)"
 */

const { execSync } = require('child_process');
const pkg = require('../package.json');

function safe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const info = {
  APP_VERSION: process.env.APP_VERSION || pkg.version,
  GIT_SHA:
    process.env.GIT_SHA ||
    process.env.GITHUB_SHA ||
    safe('git rev-parse HEAD') ||
    'unknown',
  BUILD_TIME: process.env.BUILD_TIME || new Date().toISOString(),
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
} else if (process.argv.includes('--export')) {
  for (const [key, value] of Object.entries(info)) {
    process.stdout.write(`export ${key}=${JSON.stringify(value)}\n`);
  }
} else {
  for (const [key, value] of Object.entries(info)) {
    process.stdout.write(`${key}=${value}\n`);
  }
}
