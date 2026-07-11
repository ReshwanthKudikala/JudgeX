// Editorial business logic: admin CRUD + public published read with cache.

const {
  NotFoundError,
  ConflictError,
} = require('../../shared/errors/http-errors');
const { problemRepository } = require('../problems/problems.repository');
const { editorialRepository } = require('./editorials.repository');
const {
  getCachedEditorial,
  setCachedEditorial,
  invalidateEditorialCache,
} = require('./editorials.cache');
const { toEditorialAdmin, toEditorialPublic } = require('./editorials.helpers');

class EditorialService {
  constructor({
    editorialRepository: editorialRepo,
    problemRepository: problemRepo,
  } = {}) {
    this.editorialRepository = editorialRepo || editorialRepository;
    this.problemRepository = problemRepo || problemRepository;
  }

  async #requireProblem(problemId) {
    const problem = await this.problemRepository.findById(problemId);
    if (!problem) throw new NotFoundError('Problem not found.');
    return problem;
  }

  async #slugForProblemId(problemId) {
    const problem = await this.problemRepository.findById(problemId);
    return problem?.slug || null;
  }

  async createEditorial(problemId, data, createdBy) {
    const problem = await this.#requireProblem(problemId);
    const existing = await this.editorialRepository.findByProblemId(problemId);
    if (existing) {
      throw new ConflictError('An editorial already exists for this problem.');
    }

    const row = await this.editorialRepository.create({
      problemId,
      title: data.title,
      markdown: data.markdown,
      difficulty: data.difficulty || problem.difficulty || 'medium',
      createdBy,
      published: data.published === true,
    });

    if (row.published) {
      await setCachedEditorial(problem.slug, toEditorialPublic(row));
    }

    return toEditorialAdmin(row);
  }

  async updateEditorial(id, data) {
    const existing = await this.editorialRepository.findById(id);
    if (!existing) throw new NotFoundError('Editorial not found.');

    const row = await this.editorialRepository.update(id, data);
    const slug = await this.#slugForProblemId(row.problem_id);
    await invalidateEditorialCache(slug);

    if (row.published && slug) {
      await setCachedEditorial(slug, toEditorialPublic(row));
    }

    return toEditorialAdmin(row);
  }

  async deleteEditorial(id) {
    const existing = await this.editorialRepository.findById(id);
    if (!existing) throw new NotFoundError('Editorial not found.');

    const slug = await this.#slugForProblemId(existing.problem_id);
    const deleted = await this.editorialRepository.softDelete(id);
    if (!deleted) throw new NotFoundError('Editorial not found.');

    await invalidateEditorialCache(slug);
    return { id, deleted: true };
  }

  async getEditorialAdmin(id) {
    const row = await this.editorialRepository.findById(id);
    if (!row) throw new NotFoundError('Editorial not found.');
    return toEditorialAdmin(row);
  }

  /**
   * Public: published editorial for a problem slug. 404 if missing/unpublished.
   */
  async getPublishedBySlug(slug) {
    const cached = await getCachedEditorial(slug);
    if (cached) return cached;

    const row = await this.editorialRepository.findPublishedByProblemSlug(slug);
    if (!row) throw new NotFoundError('Editorial not found.');

    const payload = toEditorialPublic(row);
    await setCachedEditorial(slug, payload);
    return payload;
  }
}

module.exports = {
  EditorialService,
  editorialService: new EditorialService(),
};
