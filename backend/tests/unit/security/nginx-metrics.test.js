const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const nginxConfPath = path.resolve(__dirname, '../../../../docker/nginx/nginx.conf');

function activeConfig(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function locationBlock(text, pattern) {
  const start = text.search(pattern);
  assert.notEqual(start, -1, 'expected location block');
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('unclosed location block');
}

describe('public Nginx metrics exposure', () => {
  it('does not proxy /metrics on the public listener', () => {
    const active = activeConfig(fs.readFileSync(nginxConfPath, 'utf8'));
    const block = locationBlock(active, /location\s+=\s+\/metrics\s*\{/);

    assert.match(block, /return\s+404\s*;/);
    assert.doesNotMatch(block, /proxy_pass/);
    assert.doesNotMatch(active, /proxy_pass[^;]*\/metrics/);
  });
});
