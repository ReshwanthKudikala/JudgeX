/**
 * Ollama provider for the Learning Coach (Sprint 41).
 * Implements the coach provider interface — swappable via factory.
 */

const { config } = require('../../../config');
const { AIError } = require('../../../shared/errors/domain-errors');

const PROVIDER_ID = 'ollama';

/**
 * Map Ollama / network failures to short, production-safe messages.
 * Never includes stack traces.
 * @param {number} status
 * @param {string} bodyText
 * @param {string} model
 * @returns {string}
 */
function friendlyOllamaHttpError(status, bodyText, model) {
  let parsed = null;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsed = null;
  }

  const raw =
    parsed && typeof parsed.error === 'string'
      ? parsed.error.trim()
      : typeof bodyText === 'string'
        ? bodyText.trim().slice(0, 200)
        : '';

  const lower = raw.toLowerCase();

  const notFound = /model ['"]?([^'"]+)['"]? not found/i.exec(raw);
  if (notFound || (status === 404 && lower.includes('not found'))) {
    const name = notFound ? notFound[1] : model;
    return `Model "${name}" not found.`;
  }

  if (raw) {
    // Capitalize first letter; keep concise.
    const msg = raw.charAt(0).toUpperCase() + raw.slice(1);
    return msg.endsWith('.') ? msg : `${msg}.`;
  }

  return `Ollama request failed (HTTP ${status}).`;
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function friendlyOllamaNetworkError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes('econnrefused') ||
    lower.includes('connection refused') ||
    lower.includes('fetch failed')
  ) {
    return 'Connection to Ollama refused.';
  }

  if (lower.includes('enotfound') || lower.includes('getaddrinfo')) {
    return 'Connection to Ollama refused.';
  }

  if (lower.includes('etimedout') || lower.includes('timeout')) {
    return 'Ollama request timed out.';
  }

  return 'Connection to Ollama refused.';
}

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
        throw new AIError(friendlyOllamaHttpError(response.status, body, model), {
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
      throw new AIError(friendlyOllamaNetworkError(err), {
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
  friendlyOllamaHttpError,
  friendlyOllamaNetworkError,
};
