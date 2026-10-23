/**
 * Unprivileged workers cannot chown the workspace to the sandbox uid.
 * The directory must still be readable and writable by uid 1000.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const {
  restrictWorkspacePermissions,
} = require('../../../src/infrastructure/docker/docker.adapter');

describe('sandbox workspace permissions', () => {
  it('keeps the directory usable by sandbox uid 1000 when chown is denied', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'judgex-perm-'));
    try {
      await restrictWorkspacePermissions(dir);
      if (process.platform === 'win32') return;

      const st = await fs.stat(dir);
      const mode = st.mode & 0o777;
      if (st.uid === 1000) {
        assert.equal(mode, 0o750);
        return;
      }
      assert.equal(mode, 0o707);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
