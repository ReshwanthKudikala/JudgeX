// Selects the AI provider from AI_PROVIDER config (default: ollama).
// ARCHITECTURE.md §9.1 / BACKEND_STRUCTURE.md §5.7 — zero caller changes on swap.

const { config } = require('../../config');
const { assertAIProvider } = require('./ai.port');
const { createOllamaProvider } = require('./ollama.adapter');
const { createOpenAIProvider } = require('./openai.adapter');

/**
 * Construct the configured AI provider.
 * @param {object} [overrides]
 * @param {'ollama'|'openai'} [overrides.provider] - force a provider (tests).
 * @param {object} [overrides.ollama] - passed to createOllamaProvider.
 * @param {object} [overrides.openai] - passed to createOpenAIProvider.
 * @returns {{ id: string, generateCompletion: Function }}
 */
function createAIProvider(overrides = {}) {
  const name = overrides.provider || config.ai.provider;

  let provider;
  switch (name) {
    case 'ollama':
      provider = createOllamaProvider(overrides.ollama || {});
      break;
    case 'openai':
      provider = createOpenAIProvider(overrides.openai || {});
      break;
    default:
      throw new Error(`Unknown AI_PROVIDER: ${name}`);
  }

  assertAIProvider(provider);
  return provider;
}

/** Process-wide singleton used by AIService (lazy). */
let defaultProvider = null;

function getAIProvider() {
  if (!defaultProvider) {
    defaultProvider = createAIProvider();
  }
  return defaultProvider;
}

/** Test helper: clear the singleton so the next getAIProvider() rebuilds. */
function resetAIProvider() {
  defaultProvider = null;
}

module.exports = {
  createAIProvider,
  getAIProvider,
  resetAIProvider,
};
