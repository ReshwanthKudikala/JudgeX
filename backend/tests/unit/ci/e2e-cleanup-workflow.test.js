/**
 * The E2E cleanup step must keep deleting sandbox-owned files without
 * widening the delete set or swallowing errors.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const workflowPath = path.resolve(__dirname, '../../../../.github/workflows/ci.yml');

function cleanupStep(yaml) {
  const start = yaml.indexOf('      - name: Remove leftover sandboxes');
  const end = yaml.indexOf('\n  backend-smtp:');
  assert.ok(start > 0, 'cleanup step missing');
  assert.ok(end > start, 'cleanup step is not bounded by the smtp job');
  return yaml.slice(start, end);
}

describe('E2E sandbox cleanup workflow', () => {
  const step = cleanupStep(fs.readFileSync(workflowPath, 'utf8'));

  it('runs after failure and only removes labeled sandboxes and judgex-* workspaces', () => {
    assert.match(step, /if: always\(\)/);
    assert.match(step, /set -euo pipefail/);
    assert.doesNotMatch(step, /\|\| true/);
    assert.doesNotMatch(step, /continue-on-error/);
    assert.match(step, /docker ps -aq --filter label=judgex\.sandbox=true/);
    assert.match(
      step,
      /find "\$\{TMPDIR:-\/tmp\}" \/tmp -maxdepth 1 -type d -name 'judgex-\*'/,
    );
    assert.match(step, /case "\$base" in\s+judgex-\*\)/s);
    assert.match(step, /Refusing to delete unexpected path/);
    assert.match(step, /sudo rm -rf -- "\$\{dirs\[@\]\}"/);
    assert.doesNotMatch(step, /rm -rf \/tmp\/\*/);
    assert.doesNotMatch(step, /sudo rm -rf \/tmp/);
  });
});
