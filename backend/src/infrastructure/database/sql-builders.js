// Generic, reusable SQL fragment builders for pagination, sorting, and filtering.
//
// SAFETY MODEL: user input NEVER reaches SQL as an identifier or literal.
//   - Values are always emitted as $N placeholders (parameterized).
//   - Column names come only from a repository-defined allow-map
//     ({ publicField: 'actual_column' }); anything not in the map is ignored.
// This is what lets repositories forbid string concatenation entirely.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Normalize untrusted page/limit input into safe bounds.
 * @returns {{ page: number, limit: number, offset: number }}
 */
function buildPagination({ page, limit } = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  let safePage = Number.parseInt(page, 10);
  if (!Number.isFinite(safePage) || safePage < 1) safePage = 1;

  let safeLimit = Number.parseInt(limit, 10);
  if (!Number.isFinite(safeLimit) || safeLimit < 1) safeLimit = defaultLimit;
  if (safeLimit > maxLimit) safeLimit = maxLimit;

  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

/**
 * Build the pagination block of API response meta (API_SPECIFICATION.md §8).
 */
function paginationMeta({ page, limit, total }) {
  const totalCount = Number(total) || 0;
  return {
    page,
    limit,
    total: totalCount,
    totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 0,
  };
}

/**
 * Build a safe ORDER BY clause from an untrusted sort token.
 *
 * @param {string} sort - 'field' | '-field' (desc) | 'field:asc' | 'field:desc'.
 * @param {Object<string,string>} allowed - map of public field -> real column.
 * @param {{ default?: string }} [options] - fallback clause body when sort is
 *        missing/invalid, e.g. 'created_at DESC' (must be trusted text).
 * @returns {string} e.g. 'ORDER BY created_at DESC' or '' when nothing applies.
 */
function buildOrderBy(sort, allowed = {}, { default: defaultClause } = {}) {
  const fallback = defaultClause ? `ORDER BY ${defaultClause}` : '';
  if (!sort || typeof sort !== 'string') return fallback;

  let field = sort;
  let direction = 'ASC';

  if (sort.startsWith('-')) {
    field = sort.slice(1);
    direction = 'DESC';
  } else if (sort.includes(':')) {
    const [rawField, rawDir] = sort.split(':');
    field = rawField;
    direction = rawDir && rawDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  }

  const column = allowed[field];
  if (!column) return fallback; // unknown field → ignore, use safe default

  return `ORDER BY ${column} ${direction}`;
}

/**
 * Build a parameterized WHERE clause from an untrusted filter object.
 *
 * Only keys present in `allowed` are used; each becomes `column = $N`.
 * A value of `null` emits `column IS NULL`; `undefined` keys are skipped.
 *
 * @param {Object} filters - untrusted { field: value } map.
 * @param {Object<string,string>} allowed - map of public field -> real column.
 * @param {{ startIndex?: number }} [options] - first placeholder index (for
 *        composing with other parameterized fragments).
 * @returns {{ clause: string, params: Array, nextIndex: number }}
 */
function buildWhere(filters = {}, allowed = {}, { startIndex = 1 } = {}) {
  const conditions = [];
  const params = [];
  let index = startIndex;

  for (const [field, value] of Object.entries(filters || {})) {
    const column = allowed[field];
    if (!column || value === undefined) continue;

    if (value === null) {
      conditions.push(`${column} IS NULL`);
    } else {
      conditions.push(`${column} = $${index}`);
      params.push(value);
      index += 1;
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildPagination,
  paginationMeta,
  buildOrderBy,
  buildWhere,
};
