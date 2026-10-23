/**
 * Source copies must not be able to leave the per-job workspace.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const { copyFiles } = require('../../../src/infrastructure/docker/docker.adapter');

describe('sandbox workspace copy', () => {
  it('writes a nested relative file and refuses paths that escape the workspace', async () => {
    const hostDir = await fs.mkdtemp(path.join(os.tmpdir(), 'judgex-copy-'));
    const outside = path.join(path.dirname(hostDir), 'judgex-escaped.txt');
    try {
      await copyFiles({ hostDir }, [
        { path: 'nested/main.py', content: 'print(1)\n' },
      ]);
      const written = await fs.readFile(path.join(hostDir, 'nested', 'main.py'), 'utf8');
      assert.equal(written, 'print(1)\n');

      await assert.rejects(
        () => copyFiles({ hostDir }, [{ path: '../judgex-escaped.txt', content: 'nope' }]),
        /inside the workspace/,
      );
      await assert.rejects(
        () => copyFiles({ hostDir }, [{ path: path.join(os.tmpdir(), 'absolute.txt'), content: 'nope' }]),
        /inside the workspace/,
      );
      await assert.rejects(
        () => fs.access(outside),
        { code: 'ENOENT' },
      );
    } finally {
      await fs.rm(hostDir, { recursive: true, force: true });
      await fs.rm(outside, { force: true });
    }
  });
});