/**
 * Sprint 17 — migration runner unit tests (filesystem + tracking helpers).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const {
  listMigrationFiles,
  migrationIdFromPath,
  migrate,
  listAppliedMigrations,
} = require('../../../src/infrastructure/database/migrator');

describe('Migration runner helpers', () => {
  it('lists numbered SQL files in lexical order', () => {
    const files = listMigrationFiles();
    assert.ok(files.length >= 1);
    assert.ok(files.every((f) => f.endsWith('.sql')));
    const ids = files.map(migrationIdFromPath);
    const sorted = [...ids].sort();
    assert.deepEqual(ids, sorted);
    assert.equal(ids[0], '001_init_schema');
  });

  it('derives migration ids from filenames', () => {
    assert.equal(
      migrationIdFromPath('/tmp/migrations/002_add_indexes.sql'),
      '002_add_indexes',
    );
  });
});

describe('Migration runner against an in-memory-like pg stub', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judgex-mig-'));
    fs.writeFileSync(path.join(tmpDir, '001_a.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(tmpDir, '002_b.sql'), 'SELECT 1;');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('applies pending migrations once and tracks them', async () => {
    const store = new Set();
    const statements = [];

    const db = {
      async query(text, params) {
        statements.push(text.trim().slice(0, 40));
        if (text.includes('schema_migrations') && text.includes('CREATE TABLE')) {
          return { rows: [] };
        }
        if (text.includes('SELECT id FROM schema_migrations')) {
          return { rows: [...store].sort().map((id) => ({ id })) };
        }
        if (text.startsWith('INSERT INTO schema_migrations')) {
          store.add(params[0]);
          return { rows: [] };
        }
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] };
        }
        if (text.includes('SELECT 1')) {
          return { rows: [{ '?column?': 1 }] };
        }
        return { rows: [] };
      },
    };

    const first = await migrate(db, { migrationsDir: tmpDir });
    assert.deepEqual(first.applied, ['001_a', '002_b']);
    assert.equal(first.skipped.length, 0);

    const second = await migrate(db, { migrationsDir: tmpDir });
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.skipped, ['001_a', '002_b']);

    const tracked = await listAppliedMigrations(db);
    assert.deepEqual(tracked, ['001_a', '002_b']);
  });
});
