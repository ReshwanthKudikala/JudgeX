// Default AI provider: local Ollama (free, no API key).
// ARCHITECTURE.md §9.1 — default so JudgeX runs end-to-end with no paid services.

const { config } = require('../../config');
const { AIError } = require('../../shared/errors/domain-errors');

const PROVIDER_ID = 'ollama';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {string} [options.model]
 * @param {typeof fetch} [options.fetchImpl] - injectable for tests.
 */
function createOllamaProvider(options = {}) {
  const baseUrl = (options.baseUrl || config.ai.ollama.baseUrl).replace(/\/$/, '');
  const model = options.model || config.ai.ollama.model;
  const fetchImpl = options.fetchImpl || fetch;

  /**
   * @param {{ system: string, user: string, timeoutMs?: number }} request
   * @returns {Promise<{ text: string, provider: string }>}
   */
  async function generateCompletion({ system, user, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AIError('Ollama request failed.', {
          status: response.status,
          body: body.slice(0, 500),
        });
      }

      const payload = await response.json();
      const text = payload && payload.message && typeof payload.message.content === 'string'
        ? payload.message.content.trim()
        : '';

      if (!text) {
        throw new AIError('Ollama returned an empty completion.');
      }

      return { text, provider: PROVIDER_ID };
    } catch (err) {
      if (err instanceof AIError) throw err;
      if (err && err.name === 'AbortError') {
        throw new AIError('Ollama request timed out.');
      }
      throw new AIError('Ollama is unavailable.', {
        cause: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return { id: PROVIDER_ID, generateCompletion };
}

module.exports = { createOllamaProvider, PROVIDER_ID };
