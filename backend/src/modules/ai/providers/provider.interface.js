/**
 * AI Provider port for the Learning Coach.
 * Business logic depends only on this contract — never on Ollama/OpenAI specifics.
 */

/**
 * @typedef {object} CoachCompletionRequest
 * @property {string} system
 * @property {string} user
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {object} CoachCompletionResult
 * @property {string} text
 * @property {string} provider
 * @property {string} [model]
 * @property {number|null} [tokensUsed]
 */

/**
 * @typedef {object} AIProvider
 * @property {string} id
 * @property {(req: CoachCompletionRequest) => Promise<CoachCompletionResult>} complete
 */

/**
 * @param {unknown} provider
 * @returns {asserts provider is AIProvider}
 */
function assertCoachProvider(provider) {
  if (
    !provider ||
    typeof provider !== 'object' ||
    typeof /** @type {AIProvider} */ (provider).complete !== 'function' ||
    typeof /** @type {AIProvider} */ (provider).id !== 'string'
  ) {
    throw new Error('AI provider must implement { id, complete() }.');
  }
}

module.exports = {
  assertCoachProvider,
};
