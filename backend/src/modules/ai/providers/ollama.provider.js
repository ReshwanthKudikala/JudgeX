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
  const numCtx = options.numCtx ?? config.ai.ollama.numCtx ?? 8192;
  const defaultNumPredict = options.numPredict ?? config.ai.ollama.numPredict ?? 512;
  const temperature = options.temperature ?? config.ai.ollama.temperature ?? 0.2;
  const keepAlive = options.keepAlive ?? config.ai.ollama.keepAlive ?? '30m';
  const fetchImpl = options.fetchImpl || fetch;

  function nsToMs(value) {
    return typeof value === 'number' ? Math.round(value / 1e6) : null;
  }

  function timingFrom(payload) {
    return {
      loadMs: nsToMs(payload?.load_duration),
      promptEvalMs: nsToMs(payload?.prompt_eval_duration),
      evalMs: nsToMs(payload?.eval_duration),
      promptTokens: typeof payload?.prompt_eval_count === 'number' ? payload.prompt_eval_count : null,
      outputTokens: typeof payload?.eval_count === 'number' ? payload.eval_count : null,
    };
  }

  function chatBody({ system, user, numPredict, stream }) {
    return {
      model,
      stream,
      keep_alive: keepAlive,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      options: {
        num_ctx: numCtx,
        num_predict: numPredict ?? defaultNumPredict,
        temperature,
      },
    };
  }

  /**
   * @param {{ system: string, user: string, timeoutMs?: number }} request
   */
  function cancelled(signal) {
    return Boolean(signal && signal.aborted);
  }

  async function complete({ system, user, timeoutMs = defaultTimeoutMs, numPredict, signal }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onAbort);

    try {
      if (cancelled(signal)) {
        throw new AIError('The coach request was cancelled.');
      }
      const response = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(chatBody({ system, user, numPredict, stream: false })),
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
        truncated: payload?.done_reason === 'length',
        ...timingFrom(payload),
      };
    } catch (err) {
      if (err instanceof AIError) throw err;
      if (cancelled(signal)) {
        throw new AIError('The coach request was cancelled.');
      }
      if (err && err.name === 'AbortError') {
        throw new AIError('Ollama request timed out.');
      }
      if (err instanceof SyntaxError) {
        throw new AIError('Ollama returned a malformed response.');
      }
      throw new AIError(friendlyOllamaNetworkError(err), {
        cause: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  async function* completeStream({ system, user, timeoutMs = defaultTimeoutMs, numPredict, signal }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onAbort);
    try {
      if (cancelled(signal)) {
        throw new AIError('The coach request was cancelled.');
      }
      const response = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(chatBody({ system, user, numPredict, stream: true })),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AIError(friendlyOllamaHttpError(response.status, body, model));
      }
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new AIError('Ollama returned a malformed response.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      let last = null;
      while (true) {
        const step = await reader.read();
        if (step.done) {
          buffer += decoder.decode();
          break;
        }
        buffer += decoder.decode(step.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let payload;
          try {
            payload = JSON.parse(line);
          } catch {
            throw new AIError('Ollama returned a malformed response.');
          }
          const piece =
            payload && payload.message && typeof payload.message.content === 'string'
              ? payload.message.content
              : '';
          if (piece) {
            text += piece;
            yield { type: 'token', text: piece };
          }
          if (payload && payload.done) last = payload;
        }
      }
      if (buffer.trim()) {
        let payload;
        try {
          payload = JSON.parse(buffer);
        } catch {
          throw new AIError('Ollama returned a malformed response.');
        }
        const piece =
          payload && payload.message && typeof payload.message.content === 'string'
            ? payload.message.content
            : '';
        if (piece) {
          text += piece;
          yield { type: 'token', text: piece };
        }
        if (payload && payload.done) last = payload;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        throw new AIError('Ollama returned an empty completion.');
      }
      const timing = timingFrom(last);
      yield {
        type: 'end',
        text: trimmed,
        truncated: last?.done_reason === 'length',
        tokensUsed:
          typeof timing.outputTokens === 'number' && typeof timing.promptTokens === 'number'
            ? timing.outputTokens + timing.promptTokens
            : timing.outputTokens,
        ...timing,
      };
    } catch (err) {
      if (err instanceof AIError) throw err;
      if (cancelled(signal)) {
        throw new AIError('The coach request was cancelled.');
      }
      if (err && err.name === 'AbortError') {
        throw new AIError('Ollama request timed out.');
      }
      if (err instanceof SyntaxError) {
        throw new AIError('Ollama returned a malformed response.');
      }
      throw new AIError(friendlyOllamaNetworkError(err));
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  return { id: PROVIDER_ID, model, complete, completeStream };
}

module.exports = {
  createOllamaProvider,
  PROVIDER_ID,
  friendlyOllamaHttpError,
  friendlyOllamaNetworkError,
};
