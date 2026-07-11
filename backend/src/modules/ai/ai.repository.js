// Persistence for AI feedback rows (DATABASE_DESIGN.md §9.4).
// Optional/additive — failures here must never affect judging.

const { BaseRepository } = require('../../infrastructure/database/base.repository');

class AIFeedbackRepository extends BaseRepository {
  /**
   * @param {{
   *   submissionId: string,
   *   userId: string,
   *   feedbackType?: string,
   *   promptSnapshot?: string|null,
   *   responseText: string,
   *   wasBlocked?: boolean,
   *   provider: string,
   * }} row
   */
  async insertFeedback(row) {
    const id = this.newId();
    return this.queryOne(
      `INSERT INTO ai_feedback (
         id, submission_id, user_id, feedback_type, prompt_snapshot,
         response_text, was_blocked, provider
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, submission_id, feedback_type, was_blocked, provider, created_at`,
      [
        id,
        row.submissionId,
        row.userId,
        row.feedbackType || 'compile_explanation',
        row.promptSnapshot || null,
        row.responseText,
        row.wasBlocked === true,
        row.provider,
      ],
    );
  }

  async findLatestCompileExplanation(submissionId) {
    return this.queryOne(
      `SELECT id, submission_id, response_text, was_blocked, provider, created_at
         FROM ai_feedback
        WHERE submission_id = $1 AND feedback_type = 'compile_explanation'
        ORDER BY created_at DESC
        LIMIT 1`,
      [submissionId],
    );
  }
}

module.exports = {
  AIFeedbackRepository,
  aiFeedbackRepository: new AIFeedbackRepository(),
};
