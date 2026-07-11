// Optional AI provider: OpenAI (enabled only when AI_PROVIDER=openai).
// ARCHITECTURE.md §9.1 — config-selected swap; callers never import this module.

const { config } = require('../../config');
const { AIError } = require('../../shared/errors/domain-errors');

const PROVIDER_ID = 'openai';
const DEFAULT_TIMEOUT_MS = 30000;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * @param {object} [options]
 * @param {string} [options.apiKey]
 * @param {string} [options.model]
 * @param {typeof fetch} [options.fetchImpl]
 */
function createOpenAIProvider(options = {}) {
  const apiKey = options.apiKey || config.ai.openai.apiKey;
  const model = options.model || config.ai.openai.model;
  const fetchImpl = options.fetchImpl || fetch;

  /**
   * @param {{ system: string, user: string, timeoutMs?: number }} request
   * @returns {Promise<{ text: string, provider: string }>}
   */
  async function generateCompletion({ system, user, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    if (!apiKey) {
      throw new AIError('OpenAI API key is not configured.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AIError('OpenAI request failed.', {
          status: response.status,
          body: body.slice(0, 500),
        });
      }

      const payload = await response.json();
      const text =
        payload &&
        payload.choices &&
        payload.choices[0] &&
        payload.choices[0].message &&
        typeof payload.choices[0].message.content === 'string'
          ? payload.choices[0].message.content.trim()
          : '';

      if (!text) {
        throw new AIError('OpenAI returned an empty completion.');
      }

      return { text, provider: PROVIDER_ID };
    } catch (err) {
      if (err instanceof AIError) throw err;
      if (err && err.name === 'AbortError') {
        throw new AIError('OpenAI request timed out.');
      }
      throw new AIError('OpenAI is unavailable.', {
        cause: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return { id: PROVIDER_ID, generateCompletion };
}

module.exports = { createOpenAIProvider, PROVIDER_ID };
