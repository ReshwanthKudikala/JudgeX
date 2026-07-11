// Discussion business logic: ownership, moderation, threading.

const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require('../../shared/errors/http-errors');
const { withTransaction } = require('../../infrastructure/database/transaction');
const { problemRepository } = require('../problems/problems.repository');
const { discussionRepository } = require('./discussions.repository');
const {
  toDiscussionSummary,
  toDiscussionDetail,
  toComment,
  buildCommentTree,
  normalizeTags,
} = require('./discussions.helpers');

class DiscussionService {
  constructor({
    discussionRepository: discussionRepo,
    problemRepository: problemRepo,
  } = {}) {
    this.discussionRepository = discussionRepo || discussionRepository;
    this.problemRepository = problemRepo || problemRepository;
  }

  async #requireProblemBySlug(slug) {
    const problem = await this.problemRepository.findBySlug(slug);
    if (!problem || !problem.is_published) {
      throw new NotFoundError('Problem not found.');
    }
    return problem;
  }

  async #requireDiscussion(id, { includeDeleted = false } = {}) {
    const row = await this.discussionRepository.findDiscussionById(id, {
      includeDeleted,
    });
    if (!row) throw new NotFoundError('Discussion not found.');
    return row;
  }

  #assertCanModerate(resourceAuthorId, actor) {
    if (!actor) throw new ForbiddenError('Authentication is required.');
    if (actor.role === 'admin') return;
    if (resourceAuthorId === actor.id) return;
    throw new ForbiddenError('You can only modify your own content.');
  }

  async listDiscussions(slug, query = {}) {
    const problem = await this.#requireProblemBySlug(slug);
    const { rows, pagination } = await this.discussionRepository.listByProblem({
      problemId: problem.id,
      page: query.page,
      limit: query.limit,
      q: query.q,
      tag: query.tag,
      sort: query.sort || 'newest',
    });

    return {
      discussions: rows.map(toDiscussionSummary),
      pagination,
    };
  }

  async createDiscussion(slug, data, author) {
    if (!author?.id) throw new ForbiddenError('Authentication is required.');
    const problem = await this.#requireProblemBySlug(slug);

    const row = await this.discussionRepository.createDiscussion({
      problemId: problem.id,
      authorId: author.id,
      title: data.title,
      body: data.body,
      tags: normalizeTags(data.tags),
    });

    return toDiscussionDetail(row, []);
  }

  async getDiscussion(id) {
    const row = await this.#requireDiscussion(id);
    const comments = await this.discussionRepository.listCommentsByDiscussion(id);
    return toDiscussionDetail(row, buildCommentTree(comments));
  }

  async updateDiscussion(id, data, actor) {
    const existing = await this.#requireDiscussion(id);
    this.#assertCanModerate(existing.author_id, actor);

    const patch = { ...data };
    if (data.tags !== undefined) patch.tags = normalizeTags(data.tags);

    const row = await this.discussionRepository.updateDiscussion(id, patch);
    if (!row) throw new NotFoundError('Discussion not found.');
    return toDiscussionDetail(row);
  }

  async deleteDiscussion(id, actor) {
    const existing = await this.#requireDiscussion(id);
    this.#assertCanModerate(existing.author_id, actor);

    const deleted = await this.discussionRepository.softDeleteDiscussion(id);
    if (!deleted) throw new NotFoundError('Discussion not found.');
    return { id, deleted: true };
  }

  async createComment(discussionId, data, author) {
    if (!author?.id) throw new ForbiddenError('Authentication is required.');
    await this.#requireDiscussion(discussionId);

    if (data.parentCommentId) {
      const parent = await this.discussionRepository.findCommentById(
        data.parentCommentId,
      );
      if (!parent || parent.discussion_id !== discussionId) {
        throw new ValidationError('parentCommentId must belong to this discussion.', [
          { field: 'parentCommentId', issue: 'invalid parent' },
        ]);
      }
    }

    const row = await withTransaction(async (client) =>
      this.discussionRepository.createComment(
        {
          discussionId,
          authorId: author.id,
          body: data.body,
          parentCommentId: data.parentCommentId || null,
        },
        client,
      ),
    );

    return toComment(row);
  }

  async updateComment(id, data, actor) {
    const existing = await this.discussionRepository.findCommentById(id);
    if (!existing) throw new NotFoundError('Comment not found.');
    this.#assertCanModerate(existing.author_id, actor);

    const row = await this.discussionRepository.updateComment(id, data.body);
    if (!row) throw new NotFoundError('Comment not found.');
    return toComment(row);
  }

  async deleteComment(id, actor) {
    const existing = await this.discussionRepository.findCommentById(id);
    if (!existing) throw new NotFoundError('Comment not found.');
    this.#assertCanModerate(existing.author_id, actor);

    const deleted = await withTransaction(async (client) =>
      this.discussionRepository.softDeleteComment(
        id,
        existing.discussion_id,
        client,
      ),
    );
    if (!deleted) throw new NotFoundError('Comment not found.');
    return { id, deleted: true };
  }

  async reportDiscussion(id, reason, reporter) {
    if (!reporter?.id) throw new ForbiddenError('Authentication is required.');
    await this.#requireDiscussion(id);
    const report = await this.discussionRepository.createReport({
      reporterId: reporter.id,
      targetType: 'discussion',
      targetId: id,
      reason,
    });
    return {
      id: report.id,
      targetType: report.target_type,
      targetId: report.target_id,
      status: report.status,
      createdAt: report.created_at,
    };
  }

  async reportComment(id, reason, reporter) {
    if (!reporter?.id) throw new ForbiddenError('Authentication is required.');
    const comment = await this.discussionRepository.findCommentById(id);
    if (!comment) throw new NotFoundError('Comment not found.');
    const report = await this.discussionRepository.createReport({
      reporterId: reporter.id,
      targetType: 'comment',
      targetId: id,
      reason,
    });
    return {
      id: report.id,
      targetType: report.target_type,
      targetId: report.target_id,
      status: report.status,
      createdAt: report.created_at,
    };
  }
}

module.exports = {
  DiscussionService,
  discussionService: new DiscussionService(),
};
