// SQL migration runner: applies numbered *.sql files once, tracked in schema_migrations.
//
// Design: additive, forward-only migrations (DATABASE_DESIGN.md §9). The runner
// is the single way production and tests materialize schema — no ad-hoc DDL.

const fs = require('fs');
const path = require('path');

const { logger } = require('../../shared/logger/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const ENSURE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * List migration files in lexical order (001_..., 002_...).
 * @returns {string[]} absolute paths
 */
function listMigrationFiles(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function migrationIdFromPath(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Apply all pending migrations against a pg Pool or Client.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {object} [options]
 * @param {string} [options.migrationsDir]
 * @returns {Promise<{ applied: string[], skipped: string[], total: number }>}
 */
async function migrate(db, options = {}) {
  const dir = options.migrationsDir || MIGRATIONS_DIR;
  const files = listMigrationFiles(dir);

  await db.query(ENSURE_TABLE_SQL);

  const { rows: appliedRows } = await db.query(
    `SELECT id FROM schema_migrations ORDER BY id ASC`,
  );
  const appliedSet = new Set(appliedRows.map((r) => r.id));

  const applied = [];
  const skipped = [];

  for (const filePath of files) {
    const id = migrationIdFromPath(filePath);
    if (appliedSet.has(id)) {
      skipped.push(id);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    const client = typeof db.connect === 'function' ? await db.connect() : null;

    try {
      const runner = client || db;
      await runner.query('BEGIN');
      try {
        await runner.query(sql);
        await runner.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
        await runner.query('COMMIT');
        applied.push(id);
        logger.info('Applied database migration', { migration: id });
      } catch (err) {
        await runner.query('ROLLBACK');
        throw err;
      }
    } finally {
      if (client) client.release();
    }
  }

  return { applied, skipped, total: files.length };
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @returns {Promise<string[]>}
 */
async function listAppliedMigrations(db) {
  await db.query(ENSURE_TABLE_SQL);
  const { rows } = await db.query(`SELECT id FROM schema_migrations ORDER BY id ASC`);
  return rows.map((r) => r.id);
}

module.exports = {
  MIGRATIONS_DIR,
  listMigrationFiles,
  migrationIdFromPath,
  migrate,
  listAppliedMigrations,
};
