// Admin platform orchestration: dashboard, users, moderation, queue, analytics, audit.

const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require('../../shared/errors/http-errors');
const {
  getSubmissionsQueue,
  SUBMISSIONS_QUEUE_NAME,
} = require('../../infrastructure/queue/queues');
const { logger } = require('../../shared/logger/logger');
const { adminPlatformRepository } = require('./admin.platform.repository');
const { auditLogRepository } = require('./admin.audit.repository');
const { cacheGet, cacheSet, cacheDel } = require('./admin.cache');

class AdminPlatformService {
  constructor({
    platformRepository = adminPlatformRepository,
    auditRepository = auditLogRepository,
  } = {}) {
    this.platformRepository = platformRepository;
    this.auditRepository = auditRepository;
  }

  async #audit(actorId, action, entityType, entityId, metadata) {
    try {
      await this.auditRepository.insert({
        actorId,
        action,
        entityType,
        entityId,
        metadata,
      });
      await cacheDel('overview');
      await cacheDel('analytics');
    } catch (err) {
      logger.warn('Failed to write audit log', {
        action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getOverview() {
    const cached = await cacheGet('overview');
    if (cached) return cached;

    const counts = await this.platformRepository.getOverviewCounts();
    let queue = null;
    let worker = null;
    try {
      const q = getSubmissionsQueue();
      const jobCounts = await q.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
      );
      queue = {
        name: SUBMISSIONS_QUEUE_NAME,
        counts: jobCounts,
        healthy: true,
      };
      worker = {
        healthy: (jobCounts.active || 0) >= 0,
        activeJobs: jobCounts.active || 0,
        waitingJobs: jobCounts.waiting || 0,
        failedJobs: jobCounts.failed || 0,
      };
    } catch (err) {
      queue = {
        name: SUBMISSIONS_QUEUE_NAME,
        counts: null,
        healthy: false,
        error: err instanceof Error ? err.message : String(err),
      };
      worker = { healthy: false, activeJobs: 0, waitingJobs: 0, failedJobs: 0 };
    }

    const payload = {
      users: {
        total: counts.total_users,
        active7d: counts.active_users_7d,
        active30d: counts.active_users_30d,
      },
      problems: {
        total: counts.total_problems,
        published: counts.published_problems,
      },
      editorials: {
        total: counts.total_editorials,
        published: counts.published_editorials,
      },
      discussions: counts.total_discussions,
      contests: counts.total_contests,
      submissions: {
        total: counts.total_submissions,
        accepted: counts.accepted_submissions,
        acceptanceRate:
          counts.total_submissions > 0
            ? Math.round((counts.accepted_submissions / counts.total_submissions) * 1000) / 10
            : 0,
      },
      queue,
      worker,
    };

    await cacheSet('overview', payload);
    return payload;
  }

  async listUsers(query) {
    const { rows, pagination } = await this.platformRepository.listUsers(query);
    return {
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        status: row.is_suspended ? 'suspended' : 'active',
        isSuspended: row.is_suspended === true,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        submissionCount: row.submission_count ?? 0,
      })),
      pagination,
    };
  }

  async suspendUser(id, actor) {
    const user = await this.platformRepository.findUserById(id);
    if (!user) throw new NotFoundError('User not found.');
    if (user.id === actor.id) {
      throw new ForbiddenError('You cannot suspend your own account.');
    }
    const updated = await this.platformRepository.setSuspended(id, {
      suspended: true,
      suspendedBy: actor.id,
    });
    await this.#audit(actor.id, 'user.suspend', 'user', id, {
      username: user.username,
    });
    return mapUserAdmin(updated);
  }

  async unsuspendUser(id, actor) {
    const user = await this.platformRepository.findUserById(id);
    if (!user) throw new NotFoundError('User not found.');
    const updated = await this.platformRepository.setSuspended(id, {
      suspended: false,
      suspendedBy: null,
    });
    await this.#audit(actor.id, 'user.unsuspend', 'user', id, {
      username: user.username,
    });
    return mapUserAdmin(updated);
  }

  async promoteAdmin(id, actor) {
    const user = await this.platformRepository.findUserById(id);
    if (!user) throw new NotFoundError('User not found.');
    if (user.role === 'admin') {
      return mapUserAdmin(user);
    }
    const updated = await this.platformRepository.setRole(id, 'admin');
    await this.#audit(actor.id, 'user.promote_admin', 'user', id, {
      username: user.username,
    });
    return mapUserAdmin(updated);
  }

  async demoteAdmin(id, actor) {
    const user = await this.platformRepository.findUserById(id);
    if (!user) throw new NotFoundError('User not found.');
    if (user.id === actor.id) {
      throw new ForbiddenError('You cannot demote your own account.');
    }
    if (user.role !== 'admin') {
      return mapUserAdmin(user);
    }
    const updated = await this.platformRepository.setRole(id, 'user');
    await this.#audit(actor.id, 'user.demote_admin', 'user', id, {
      username: user.username,
    });
    return mapUserAdmin(updated);
  }

  async listModeration(query) {
    const entityType = query.entityType || 'problems';
    let result;
    if (entityType === 'problems') {
      result = await this.platformRepository.listModerationProblems(query);
    } else if (entityType === 'editorials') {
      result = await this.platformRepository.listModerationEditorials(query);
    } else if (entityType === 'discussions') {
      result = await this.platformRepository.listModerationDiscussions(query);
    } else if (entityType === 'comments') {
      result = await this.platformRepository.listModerationComments(query);
    } else {
      throw new ValidationError('Invalid entityType.');
    }

    return {
      entityType,
      items: result.rows.map(mapModerationItem),
      pagination: result.pagination,
    };
  }

  async bulkModeration({ entityType, action, ids }, actor) {
    const allowed = {
      problems: ['publish', 'unpublish', 'delete', 'restore'],
      editorials: ['publish', 'unpublish', 'delete', 'restore'],
      discussions: ['delete', 'restore'],
      comments: ['delete', 'restore'],
    };
    if (!allowed[entityType]?.includes(action)) {
      throw new ValidationError(
        `Action "${action}" is not supported for ${entityType}.`,
      );
    }

    let affected = 0;
    if (entityType === 'problems') {
      affected = await this.platformRepository.bulkProblems(action, ids);
    } else if (entityType === 'editorials') {
      affected = await this.platformRepository.bulkEditorials(action, ids);
    } else if (entityType === 'discussions') {
      affected = await this.platformRepository.bulkDiscussions(action, ids);
    } else if (entityType === 'comments') {
      affected = await this.platformRepository.bulkComments(action, ids);
    }

    await this.#audit(actor.id, `moderation.${action}`, entityType, null, {
      ids,
      affected,
    });

    return { entityType, action, requested: ids.length, affected };
  }

  async getQueueStatus() {
    const queue = getSubmissionsQueue();
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    return {
      name: SUBMISSIONS_QUEUE_NAME,
      counts,
    };
  }

  async listFailedJobs({ start = 0, end = 49 } = {}) {
    const queue = getSubmissionsQueue();
    const jobs = await queue.getFailed(start, end);
    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        failedReason: job.failedReason || null,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn || null,
        data: {
          submissionId: job.data?.submissionId || null,
        },
      })),
    };
  }

  async retryFailedJobs(actor) {
    const queue = getSubmissionsQueue();
    const failed = await queue.getFailed(0, 199);
    let retried = 0;
    for (const job of failed) {
      // eslint-disable-next-line no-await-in-loop
      await job.retry();
      retried += 1;
    }
    await this.#audit(actor.id, 'queue.retry_failed', 'queue', null, { retried });
    return { retried };
  }

  async clearCompletedJobs(actor) {
    const queue = getSubmissionsQueue();
    await queue.clean(0, 1000, 'completed');
    await this.#audit(actor.id, 'queue.clear_completed', 'queue', null, {});
    return { cleared: true };
  }

  async getAnalytics({ days = 14 } = {}) {
    const cacheKey = `analytics:${days}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const [daily, mostSolved, mostActive, languages, contests] = await Promise.all([
      this.platformRepository.analyticsDailySubmissions(days),
      this.platformRepository.analyticsMostSolved(10),
      this.platformRepository.analyticsMostActiveUsers(10),
      this.platformRepository.analyticsLanguageUsage(),
      this.platformRepository.analyticsContestParticipation(),
    ]);

    const totalSubs = daily.reduce((sum, d) => sum + Number(d.submissions || 0), 0);
    const totalAccepted = daily.reduce((sum, d) => sum + Number(d.accepted || 0), 0);

    const payload = {
      dailySubmissions: daily.map((d) => ({
        date: d.date,
        submissions: d.submissions,
        accepted: d.accepted,
      })),
      acceptanceRate:
        totalSubs > 0 ? Math.round((totalAccepted / totalSubs) * 1000) / 10 : 0,
      mostSolvedProblems: mostSolved.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        solvedCount: p.solved_count,
      })),
      mostActiveUsers: mostActive.map((u) => ({
        id: u.id,
        username: u.username,
        submissionCount: u.submission_count,
        problemsSolved: u.problems_solved,
      })),
      languageUsage: languages.map((l) => ({
        language: l.language,
        count: l.count,
      })),
      contestParticipation: contests.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        participants: c.participants,
      })),
    };

    await cacheSet(cacheKey, payload, 60);
    return payload;
  }

  async listAuditLogs(query) {
    const { rows, pagination } = await this.auditRepository.list(query);
    return {
      logs: rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorUsername: row.actor_username,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      })),
      pagination,
    };
  }
}

function mapUserAdmin(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.is_suspended ? 'suspended' : 'active',
    isSuspended: row.is_suspended === true,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || null,
    submissionCount: row.submission_count ?? undefined,
  };
}

function mapModerationItem(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    title: row.title || row.body_preview || row.slug || null,
    slug: row.slug || row.problem_slug || null,
    difficulty: row.difficulty || null,
    published: row.is_published ?? row.published ?? null,
    isDeleted: row.is_deleted === true,
    authorUsername: row.author_username || null,
    discussionId: row.discussion_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  AdminPlatformService,
  adminPlatformService: new AdminPlatformService(),
};
