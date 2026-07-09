# Database Foundation & Repository Conventions

This folder is the **reusable database infrastructure** every feature repository
builds on. It contains no feature logic, no table names, and no CRUD — only the
generic plumbing described below. Source of truth: `docs/DATABASE_DESIGN.md` and
`docs/BACKEND_STRUCTURE.md`.

## Modules

| File | Responsibility |
|------|----------------|
| `pool.js` | Owns the single `pg.Pool` (startup/health/shutdown). The **only** connection owner. |
| `query.js` | `query` / `queryOne` / `queryMany` — parameterized execution + error mapping. |
| `transaction.js` | `withTransaction(callback, { isolationLevel })` — unit-of-work with BEGIN/COMMIT/ROLLBACK and guaranteed client release. |
| `sql-builders.js` | Allow-list-based `buildPagination`, `paginationMeta`, `buildOrderBy`, `buildWhere`. |
| `errors.js` | `mapDatabaseError` — translates SQLSTATE/driver errors into `AppError`s. |
| `base.repository.js` | `BaseRepository` — generic helpers subclasses extend. No tables, no CRUD. |

## Conventions for future repositories

1. **One repository per aggregate.** e.g. `users`, `problems`, `submissions`
   each get exactly one repository that owns all access to that aggregate's
   tables. No repository reaches into another aggregate's tables.
2. **Extend `BaseRepository`.** Reuse `query*`, `withTransaction`, the builders,
   and `newId()`/`now()`; do not re-implement plumbing.
3. **No business logic in repositories.** They read/write rows and map rows to
   domain objects. Rules, orchestration, and cross-aggregate coordination live
   in the **service** layer (`BACKEND_STRUCTURE.md` §4).
4. **Parameterized queries only.** Every value is passed as a `$N` placeholder.
   **Never** concatenate or template user input into SQL. Column/sort fields are
   whitelisted via the `{ publicField: 'real_column' }` maps used by the builders.
5. **No direct pool usage outside `infrastructure/database`.** Services and
   controllers never import `pool.js`; they call repositories, which use
   `query.js`/`transaction.js`.
6. **Transaction ownership belongs to the service layer.** Services call
   `withTransaction` for multi-step units of work and pass the transaction
   `client` into each repository method. Repository methods accept an optional
   trailing `client` argument and use it when present, otherwise the pool.
7. **Enqueue/side effects happen after COMMIT.** Non-DB effects (e.g. BullMQ
   enqueue) run only after the transaction commits (persist-before-enqueue,
   `DATABASE_DESIGN.md` §7.1) — never inside the DB transaction.
8. **Errors are already mapped.** `query`/`withTransaction` throw `AppError`s
   (`ConflictError`, `ValidationError`, `SerializationFailureError`,
   `DatabaseUnavailableError`, `DatabaseError`). Repositories should not catch
   raw driver errors; let mapped errors propagate (a service may translate a
   generic `ConflictError` into a domain-specific one, e.g. `EMAIL_ALREADY_EXISTS`).

## Example shape (illustrative only — not implemented this sprint)

```js
const { BaseRepository } = require('../../infrastructure/database/base.repository');

class ExampleRepository extends BaseRepository {
  // Optional trailing `client` lets this call join a service's transaction.
  findById(id, client) {
    return this.queryOne('SELECT * FROM example WHERE id = $1', [id], client);
  }
}
```
