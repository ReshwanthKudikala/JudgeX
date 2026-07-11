function toEditorialAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    problemId: row.problem_id,
    title: row.title,
    markdown: row.markdown,
    difficulty: row.difficulty,
    createdBy: row.created_by,
    published: row.published === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEditorialPublic(row) {
  if (!row) return null;
  return {
    title: row.title,
    markdown: row.markdown,
    updatedAt: row.updated_at,
  };
}

module.exports = { toEditorialAdmin, toEditorialPublic };
