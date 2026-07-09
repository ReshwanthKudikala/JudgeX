// Generic base repository — the abstraction every future repository extends.
//
// It provides ONLY generic database helpers (parameterized execution,
// transactions, pagination/sorting/filtering builders, id/timestamp helpers).
// It intentionally knows NOTHING about users, problems, submissions, auth, or
// any table name, and implements NO CRUD. Subclasses supply their own SQL and
// table knowledge while reusing this plumbing.

const { query, queryOne, queryMany } = require('./query');
const { withTransaction } = require('./transaction');
const {
  buildPagination,
  paginationMeta,
  buildOrderBy,
  buildWhere,
} = require('./sql-builders');
const { newId, now, nowIso } = require('../../shared/utils');

class BaseRepository {
  // --- Execution (accept an optional tx client so a repo call can join a
  //     caller's transaction; omit it to use the shared pool) ---------------

  // Run a parameterized statement; returns the full pg QueryResult.
  query(text, params, client) {
    return query(text, params, client);
  }

  // Run a statement; returns the first row or null.
  queryOne(text, params, client) {
    return queryOne(text, params, client);
  }

  // Run a statement; returns all rows (possibly empty).
  queryMany(text, params, client) {
    return queryMany(text, params, client);
  }

  // Run a callback inside a transaction (unit-of-work). Statements inside must
  // use the provided client to be part of the transaction.
  withTransaction(callback, options) {
    return withTransaction(callback, options);
  }

  // --- Query-shaping helpers (see sql-builders for the safety model) --------

  buildPagination(input, options) {
    return buildPagination(input, options);
  }

  paginationMeta(input) {
    return paginationMeta(input);
  }

  buildOrderBy(sort, allowed, options) {
    return buildOrderBy(sort, allowed, options);
  }

  buildWhere(filters, allowed, options) {
    return buildWhere(filters, allowed, options);
  }

  // --- Value helpers --------------------------------------------------------

  // New UUID v7 primary key.
  newId() {
    return newId();
  }

  // Current time as a Date (for timestamptz params).
  now() {
    return now();
  }

  // Current time as an ISO-8601 string.
  nowIso() {
    return nowIso();
  }
}

module.exports = { BaseRepository };
