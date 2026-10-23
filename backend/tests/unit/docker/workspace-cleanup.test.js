/**
 * Sandbox workspace cleanup must not delete paths outside the configured root.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const { config } = require('../../../src/config');
const {
  isInsideWorkspaceRoot,
} = require('../../../src/infrastructure/docker/docker.adapter');

describe('sandbox workspace path guard', () => {
  it('accepts directories under the configured workspace root', () => {
    const root = path.resolve(config.judge.workspaceDir || os.tmpdir());
    const child = path.join(root, 'judgex-abc123');
    assert.equal(isInsideWorkspaceRoot(child), true);
  });

  it('rejects paths that escape the workspace root', () => {
    const root = path.resolve(config.judge.workspaceDir || os.tmpdir());
    const escaped = path.resolve(root, '..', 'unrelated-judgex-dir');
    assert.equal(isInsideWorkspaceRoot(escaped), false);
  });
});
