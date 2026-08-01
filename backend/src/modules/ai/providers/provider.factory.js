/**
 * Selects the Learning Coach AI provider from AI_PROVIDER.
 * Controllers never import a concrete provider.
 */

const { config } = require('../../../config');
const { assertCoachProvider } = require('./provider.interface');
const { createOllamaProvider } = require('./ollama.provider');

/**
 * @param {object} [overrides]
 * @param {string} [overrides.provider]
 * @param {object} [overrides.ollama]
 */
function createCoachProvider(overrides = {}) {
  const name = overrides.provider || config.ai.provider;

  let provider;
  switch (name) {
    case 'ollama':
      provider = createOllamaProvider(overrides.ollama || {});
      break;
    // Future: openai, gemini, claude — zero controller changes.
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${name}". Supported for coach foundation: ollama.`,
      );
  }

  assertCoachProvider(provider);
  return provider;
}

let defaultProvider = null;

function getCoachProvider() {
  if (!defaultProvider) {
    defaultProvider = createCoachProvider();
  }
  return defaultProvider;
}

function resetCoachProvider() {
  defaultProvider = null;
}

module.exports = {
  createCoachProvider,
  getCoachProvider,
  resetCoachProvider,
};
