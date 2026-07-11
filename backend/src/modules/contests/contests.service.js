// Contest business logic: CRUD coordination, join rules, problem visibility,
// and scoreboard. No Express/SQL here beyond repository delegation.

const { withTransaction } = require('../../infrastructure/database/transaction');
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} = require('../../shared/errors/http-errors');
const { contestRepository } = require('./contests.repository');
const { problemRepository } = require('../problems/problems.repository');
const {
  deriveContestStatus,
  toContestSummary,
  toContestProblem,
} = require('./contests.helpers');
const {
  getCachedContestList,
  setCachedContestList,
  invalidateContestListCache,
} = require('./contests.cache');

function minutesBetween(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 60000));
}

class ContestService {
  constructor({
    contestRepository: contestRepo,
    problemRepository: problemRepo,
  } = {}) {
    this.contestRepository = contestRepo || contestRepository;
    this.problemRepository = problemRepo || problemRepository;
  }

  async #assertProblemsExist(problemIds, client) {
    const unique = [...new Set(problemIds)];
    const existing = await this.problemRepository.findExistingIds(unique, client);
    for (const problemId of unique) {
      if (!existing.has(problemId)) {
        throw new NotFoundError(`Problem not found: ${problemId}`);
      }
    }
  }

  /**
   * Admin: create contest (+ optional problem set).
   */
  async createContest(data, createdBy) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    if (!(endTime > startTime)) {
      throw new ValidationError('endTime must be after startTime.', [
        { field: 'endTime', issue: 'must be after startTime' },
      ]);
    }

    const durationMinutes = data.durationMinutes ?? minutesBetween(startTime, endTime);
    const status = deriveContestStatus({
      start_time: startTime,
      end_time: endTime,
    });

    const detail = await withTransaction(async (client) => {
      if (Array.isArray(data.problems) && data.problems.length > 0) {
        await this.#assertProblemsExist(
          data.problems.map((p) => p.problemId),
          client,
        );
      }

      const row = await this.contestRepository.createContest(
        {
          title: data.title,
          description: data.description,
          startTime,
          endTime,
          durationMinutes,
          visibility: data.visibility ?? 'public',
          status,
          createdBy,
        },
        client,
      );

      if (Array.isArray(data.problems) && data.problems.length > 0) {
        await this.contestRepository.replaceContestProblems(row.id, data.problems, client);
      }

      return this.#toDetail(row, {
        client,
        viewer: { id: createdBy, role: 'admin' },
        includeProblems: true,
      });
    });
    await invalidateContestListCache();
    return detail;
  }

  async updateContest(id, data) {
    const existing = await this.contestRepository.findById(id);
    if (!existing) throw new NotFoundError('Contest not found.');

    const startTime = data.startTime !== undefined ? new Date(data.startTime) : existing.start_time;
    const endTime = data.endTime !== undefined ? new Date(data.endTime) : existing.end_time;
    if (!(new Date(endTime) > new Date(startTime))) {
      throw new ValidationError('endTime must be after startTime.', [
        { field: 'endTime', issue: 'must be after startTime' },
      ]);
    }

    const patch = { ...data };
    if (data.startTime !== undefined) patch.startTime = startTime;
    if (data.endTime !== undefined) patch.endTime = endTime;
    if (data.durationMinutes === undefined && (data.startTime || data.endTime)) {
      patch.durationMinutes = minutesBetween(startTime, endTime);
    }
    patch.status = deriveContestStatus({
      start_time: startTime,
      end_time: endTime,
    });

    const detail = await withTransaction(async (client) => {
      if (Array.isArray(data.problems)) {
        await this.#assertProblemsExist(
          data.problems.map((p) => p.problemId),
          client,
        );
        await this.contestRepository.replaceContestProblems(id, data.problems, client);
        delete patch.problems;
      }

      const row = await this.contestRepository.updateContest(id, patch, client);
      if (!row) throw new NotFoundError('Contest not found.');
      return this.#toDetail(row, {
        client,
        viewer: { role: 'admin' },
        includeProblems: true,
      });
    });
    await invalidateContestListCache();
    return detail;
  }

  async deleteContest(id) {
    const row = await this.contestRepository.softDelete(id);
    if (!row) throw new NotFoundError('Contest not found.');
    await invalidateContestListCache();
    return { id: row.id, deleted: true };
  }

  async getContestAdmin(id) {
    const row = await this.contestRepository.findById(id);
    if (!row) throw new NotFoundError('Contest not found.');
    return this.#toDetail(row, {
      includeProblems: true,
      viewer: { role: 'admin' },
    });
  }

  async listContests(filters = {}, viewer = null) {
    const cacheFilters = {
      page: filters.page,
      limit: filters.limit,
      status: filters.status || '',
      sort: filters.sort || '',
    };

    let listResult = await getCachedContestList(cacheFilters);
    if (!listResult) {
      listResult = await this.contestRepository.listContests({
        ...filters,
        visibility: 'public',
      });
      await setCachedContestList(cacheFilters, listResult);
    }

    const { rows, total, page, limit } = listResult;
    const joinedIds = viewer?.id
      ? await this.contestRepository.findParticipatingContestIds(
          viewer.id,
          rows.map((r) => r.id),
        )
      : new Set();

    return {
      contests: rows.map((row) =>
        toContestSummary(row, { joined: joinedIds.has(row.id) }),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async getContestById(id, viewer = null) {
    const row = await this.contestRepository.findById(id);
    if (!row) throw new NotFoundError('Contest not found.');
    if (row.visibility === 'private') {
      const isAdmin = viewer?.role === 'admin';
      if (!isAdmin) throw new NotFoundError('Contest not found.');
    }
    return this.#toDetail(row, { viewer, includeProblems: false });
  }

  async joinContest(id, userId) {
    const row = await this.contestRepository.findById(id);
    if (!row) throw new NotFoundError('Contest not found.');
    if (row.visibility === 'private') {
      throw new ForbiddenError('This contest is private.');
    }

    const status = deriveContestStatus(row);
    if (status === 'ended') {
      throw new ConflictError('Contest has already ended.');
    }

    const existing = await this.contestRepository.findParticipant(id, userId);
    if (existing) {
      return {
        contestId: id,
        userId,
        joinedAt: existing.joined_at,
        alreadyJoined: true,
      };
    }

    const participant = await this.contestRepository.addParticipant(id, userId);
    return {
      contestId: participant.contest_id,
      userId: participant.user_id,
      joinedAt: participant.joined_at,
      alreadyJoined: false,
    };
  }

  /**
   * Problem list with visibility rules:
   * - upcoming: hidden (empty / marked hidden) except admin
   * - running: participants only
   * - ended: public
   */
  async getContestProblems(id, viewer = null) {
    const row = await this.contestRepository.findById(id);
    if (!row) throw new NotFoundError('Contest not found.');

    const status = deriveContestStatus(row);
    const isAdmin = viewer?.role === 'admin';
    let isParticipant = false;
    if (viewer?.id) {
      const p = await this.contestRepository.findParticipant(id, viewer.id);
      isParticipant = Boolean(p);
    }

    if (status === 'upcoming' && !isAdmin) {
      return { contestId: id, status, problems: [], hidden: true };
    }

    if (status === 'running' && !isParticipant && !isAdmin) {
      throw new ForbiddenError('Join the contest to view problems.');
    }

    const problems = await this.contestRepository.listContestProblems(id);
    return {
      contestId: id,
      status,
      problems: problems.map((p) => toContestProblem(p, { hideDetails: false })),
      hidden: false,
    };
  }

  async getScoreboard(id, filters = {}) {
    const row = await this.contestRepository.findById(id);
    if (!row) throw new NotFoundError('Contest not found.');

    const status = deriveContestStatus(row);
    if (status === 'upcoming') {
      return {
        contestId: id,
        status,
        entries: [],
        pagination: {
          page: filters.page || 1,
          limit: filters.limit || 20,
          total: 0,
          totalPages: 0,
        },
        participantCount: await this.contestRepository.countParticipants(id),
      };
    }

    const { page, limit, offset } = this.contestRepository.buildPagination(filters);
    const { rows, total } = await this.contestRepository.getScoreboard(id, {
      page,
      limit,
      offset,
    });

    return {
      contestId: id,
      status,
      entries: rows.map((r) => ({
        rank: r.rank,
        userId: r.user_id,
        username: r.username,
        solved: r.solved,
        penalty: r.penalty,
        finishTime: r.finish_time,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
      participantCount: total,
    };
  }

  async #toDetail(row, { viewer = null, includeProblems = true, hideDetails, client } = {}) {
    const participantCount = await this.contestRepository.countParticipants(row.id, client);
    let joined = false;
    if (viewer?.id) {
      const p = await this.contestRepository.findParticipant(row.id, viewer.id, client);
      joined = Boolean(p);
    }

    const summary = toContestSummary(row, { participantCount, joined });

    if (!includeProblems) return summary;

    const status = deriveContestStatus(row);
    const isAdmin = viewer?.role === 'admin';
    const shouldHide =
      hideDetails === true ||
      (status === 'upcoming' && !isAdmin) ||
      (status === 'running' && !joined && !isAdmin);

    if (shouldHide && !isAdmin) {
      return { ...summary, problems: [] };
    }

    const problems = await this.contestRepository.listContestProblems(row.id, client);
    return {
      ...summary,
      problems: problems.map((p) => toContestProblem(p, { hideDetails: false })),
    };
  }
}

module.exports = { ContestService, contestService: new ContestService() };
