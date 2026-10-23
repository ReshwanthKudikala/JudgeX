const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', '..', '..');
const composePath = path.join(root, 'docker-compose.prod.yml');
const entrypointPath = path.join(root, 'backend', 'scripts', 'docker-entrypoint-api.sh');

function serviceBlock(source, name) {
  const marker = `\n  ${name}:\n`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `missing service ${name}`);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\n  [a-z0-9-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('Production Compose migration ordering', () => {
  const source = fs.readFileSync(composePath, 'utf8');
  const migrate = serviceBlock(source, 'migrate');
  const api = serviceBlock(source, 'api');
  const worker = serviceBlock(source, 'worker');
  const cleanup = serviceBlock(source, 'cleanup-worker');

  it('runs migrations once, after Postgres is healthy, and does not restart on failure', () => {
    assert.match(migrate, /restart: "no"/);
    assert.match(migrate, /command: \["node", "scripts\/migrate\.js"\]/);
    assert.match(migrate, /dockerfile: Dockerfile\.api/);
    assert.match(migrate, /postgres:\s+condition: service_healthy/);
    assert.doesNotMatch(migrate, /condition: service_completed_successfully/);
  });

  it('starts the API only after the migrate service exits 0', () => {
    assert.match(api, /migrate:\s+condition: service_completed_successfully/);
    assert.match(worker, /migrate:\s+condition: service_completed_successfully/);
    assert.match(cleanup, /migrate:\s+condition: service_completed_successfully/);
  });

  it('does not migrate inside each API container', () => {
    const entrypoint = fs.readFileSync(entrypointPath, 'utf8');
    assert.doesNotMatch(entrypoint, /migrate\.js/);
    assert.match(entrypoint, /exec node src\/server\.js/);
  });
});
