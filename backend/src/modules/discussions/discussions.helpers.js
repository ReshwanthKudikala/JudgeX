function toAuthor(row) {
  if (!row.author_id) return null;
  return {
    id: row.author_id,
    username: row.author_username || null,
  };
}

function toDiscussionSummary(row) {
  return {
    id: row.id,
    problemId: row.problem_id,
    problemSlug: row.problem_slug || undefined,
    authorId: row.author_id,
    author: toAuthor(row),
    title: row.title,
    bodyPreview: truncate(row.body, 240),
    tags: Array.isArray(row.tags) ? row.tags : [],
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDiscussionDetail(row, comments = []) {
  return {
    id: row.id,
    problemId: row.problem_id,
    problemSlug: row.problem_slug || undefined,
    authorId: row.author_id,
    author: toAuthor(row),
    title: row.title,
    body: row.body,
    tags: Array.isArray(row.tags) ? row.tags : [],
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments,
  };
}

function toComment(row) {
  return {
    id: row.id,
    discussionId: row.discussion_id,
    authorId: row.author_id,
    author: toAuthor(row),
    body: row.is_deleted ? '[deleted]' : row.body,
    parentCommentId: row.parent_comment_id,
    isDeleted: row.is_deleted === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: [],
  };
}

function buildCommentTree(flatRows) {
  const byId = new Map();
  const roots = [];

  for (const row of flatRows) {
    byId.set(row.id, toComment(row));
  }

  for (const comment of byId.values()) {
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}

function truncate(text, max) {
  const raw = String(text || '');
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((t) => String(t || '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  return [...new Set(cleaned)];
}

module.exports = {
  toDiscussionSummary,
  toDiscussionDetail,
  toComment,
  buildCommentTree,
  normalizeTags,
};
