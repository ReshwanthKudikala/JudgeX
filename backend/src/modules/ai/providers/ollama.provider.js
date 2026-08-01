/**
 * Ollama provider for the Learning Coach (Sprint 41).
 * Implements the coach provider interface — swappable via factory.
 */

const { config } = require('../../../config');
const { AIError } = require('../../../shared/errors/domain-errors');

const PROVIDER_ID = 'ollama';

/**
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {string} [options.model]
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 */
function createOllamaProvider(options = {}) {
  const baseUrl = (options.baseUrl || config.ai.ollama.baseUrl).replace(/\/$/, '');
  const model = options.model || config.ai.ollama.model;
  const defaultTimeoutMs = options.timeoutMs || config.ai.timeoutMs;
  const fetchImpl = options.fetchImpl || fetch;

  /**
   * @param {{ system: string, user: string, timeoutMs?: number }} request
   */
  async function complete({ system, user, timeoutMs = defaultTimeoutMs }) {
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
      const text =
        payload && payload.message && typeof payload.message.content === 'string'
          ? payload.message.content.trim()
          : '';

      if (!text) {
        throw new AIError('Ollama returned an empty completion.');
      }

      const tokensUsed =
        typeof payload?.eval_count === 'number' && typeof payload?.prompt_eval_count === 'number'
          ? payload.eval_count + payload.prompt_eval_count
          : typeof payload?.eval_count === 'number'
            ? payload.eval_count
            : null;

      return {
        text,
        provider: PROVIDER_ID,
        model,
        tokensUsed,
      };
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

  return { id: PROVIDER_ID, model, complete };
}

module.exports = {
  createOllamaProvider,
  PROVIDER_ID,
};
