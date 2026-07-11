// Provider-agnostic AIProvider port (ARCHITECTURE.md §9.1).
//
// Concrete adapters (Ollama, OpenAI, …) implement this contract. Business code
// never imports an adapter — only AIService depends on this port.

/**
 * @typedef {object} AICompletionRequest
 * @property {string} system - system prompt (guardrail contract).
 * @property {string} user - user/task content (already gated).
 * @property {number} [timeoutMs] - soft deadline; adapters abort and throw AIError.
 */

/**
 * @typedef {object} AICompletionResult
 * @property {string} text - raw model text (pre output-validation).
 * @property {string} provider - adapter id, e.g. 'ollama' | 'openai'.
 */

/**
 * @interface AIProvider
 * Generate a single completion for a fixed system+user prompt pair.
 * @function generateCompletion
 * @param {AICompletionRequest} request
 * @returns {Promise<AICompletionResult>}
 * @throws {import('../../shared/errors/domain-errors').AIError}
 */

/** Canonical method name every adapter must expose. */
const GENERATE_COMPLETION = 'generateCompletion';

/**
 * Lightweight runtime check so a mis-wired factory fails fast.
 * @param {object} provider
 * @returns {asserts provider is AIProvider}
 */
function assertAIProvider(provider) {
  if (!provider || typeof provider[GENERATE_COMPLETION] !== 'function') {
    throw new Error('AI provider must implement generateCompletion().');
  }
}

module.exports = {
  GENERATE_COMPLETION,
  assertAIProvider,
};
