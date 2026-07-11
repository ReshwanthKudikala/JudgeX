/**
 * Sprint 30 — discussion helpers unit tests (no DB).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCommentTree,
  normalizeTags,
  toDiscussionSummary,
} = require('../../../src/modules/discussions/discussions.helpers');

describe('Discussion helpers', () => {
  it('normalizes and dedupes tags', () => {
    assert.deepEqual(normalizeTags([' HashMap ', 'hashmap', 'DP', '']), [
      'hashmap',
      'dp',
    ]);
  });

  it('builds a nested comment tree', () => {
    const tree = buildCommentTree([
      {
        id: '1',
        discussion_id: 'd',
        author_id: 'a',
        author_username: 'alice',
        body: 'root',
        parent_comment_id: null,
        is_deleted: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: '2',
        discussion_id: 'd',
        author_id: 'b',
        author_username: 'bob',
        body: 'reply',
        parent_comment_id: '1',
        is_deleted: false,
        created_at: '2026-01-02',
        updated_at: '2026-01-02',
      },
    ]);

    assert.equal(tree.length, 1);
    assert.equal(tree[0].replies.length, 1);
    assert.equal(tree[0].replies[0].body, 'reply');
  });

  it('maps discussion summaries with preview', () => {
    const summary = toDiscussionSummary({
      id: '1',
      problem_id: 'p',
      author_id: 'a',
      author_username: 'alice',
      title: 'Hello',
      body: 'x'.repeat(300),
      tags: ['dp'],
      like_count: 0,
      comment_count: 3,
      created_at: 't1',
      updated_at: 't2',
    });
    assert.equal(summary.commentCount, 3);
    assert.ok(summary.bodyPreview.endsWith('…'));
  });
});
