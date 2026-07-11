// Three-layer AI guardrails (ARCHITECTURE.md §9.3).
// Layer 1: input gate — server assembles the prompt; strip junk / bound size.
// Layer 2: system-prompt contract — coach, never solve.
// Layer 3: output validation — redact / block solution-like replies.

const MAX_STDERR_CHARS = 4000;
const MAX_CODE_FENCE_LINES = 12;
const SAFE_FALLBACK = {
  explanation:
    'The compiler reported an error in your source. Check the reported line and nearby syntax (brackets, punctuation, types, and declarations).',
  likelyCause: 'A syntax or type error near the location indicated by the compiler message.',
  possibleFix:
    'Re-read the compiler message, fix the indicated construct, and recompile. Do not replace your whole program with an unrelated solution.',
};

/**
 * Layer 2 — fixed system prompt. Never asks the model for a full solution.
 */
function buildSystemPrompt() {
  return [
    'You are a programming coach for JudgeX.',
    'Explain compiler/interpreter errors ONLY.',
    'NEVER provide a complete solution, a full corrected program, or copy-pasteable working code for the problem.',
    'NEVER rewrite the user\'s entire source file.',
    'You MAY mention small illustrative snippets of at most a few tokens (e.g. a missing semicolon) but not multi-line solutions.',
    'Respond with ONLY a JSON object with exactly these keys:',
    '  "explanation" — short plain-language summary of what the error means,',
    '  "likelyCause" — the most likely root cause,',
    '  "possibleFix" — a high-level fix direction (no full code).',
    'No markdown fences around the JSON. No extra keys.',
  ].join(' ');
}

/**
 * Layer 1 — gate/sanitize inputs the model is allowed to see.
 * @param {{ language: string, compileOutput: string }} input
 * @returns {{ language: string, compileOutput: string }}
 */
function gateCompileErrorInput({ language, compileOutput }) {
  const lang = String(language || '').trim().toLowerCase();
  if (lang !== 'python' && lang !== 'cpp') {
    throw new Error('Unsupported language for compile-error explanation.');
  }

  let stderr = String(compileOutput || '')
    .replace(/\0/g, '')
    .trim();

  if (!stderr) {
    throw new Error('Compiler output is required for an explanation.');
  }

  if (stderr.length > MAX_STDERR_CHARS) {
    stderr = `${stderr.slice(0, MAX_STDERR_CHARS)}\n…[truncated]`;
  }

  return { language: lang, compileOutput: stderr };
}

/**
 * Build the user message after gating (no problem statement, no solution hints).
 */
function buildUserPrompt({ language, compileOutput }) {
  return [
    `Language: ${language}`,
    'Compiler / interpreter diagnostics:',
    '---',
    compileOutput,
    '---',
    'Explain this error as JSON with keys explanation, likelyCause, possibleFix.',
  ].join('\n');
}

/**
 * Layer 3 — detect responses that look like a full solution.
 * @param {string} text
 * @returns {{ ok: boolean, text: string, wasBlocked: boolean }}
 */
function validateOutput(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { ok: false, text: '', wasBlocked: true };
  }

  // Large fenced code blocks are treated as solution leakage.
  const fenceMatch = raw.match(/```[\s\S]*?```/g) || [];
  for (const block of fenceMatch) {
    const lines = block.split('\n').length;
    if (lines > MAX_CODE_FENCE_LINES) {
      return { ok: false, text: raw, wasBlocked: true };
    }
  }

  // Very long responses with many code-like lines.
  const codeLike = (raw.match(/^\s*(def |class |#include|int main\s*\()/gm) || []).length;
  if (codeLike >= 3 && raw.length > 800) {
    return { ok: false, text: raw, wasBlocked: true };
  }

  return { ok: true, text: raw, wasBlocked: false };
}

/**
 * Parse model text into the structured explanation shape.
 * Tolerates raw JSON or JSON embedded in surrounding prose.
 * @param {string} text
 * @returns {{ explanation: string, likelyCause: string, possibleFix: string }}
 */
function parseExplanation(text) {
  const raw = String(text || '').trim();
  let parsed = null;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    const explanation = String(parsed.explanation || parsed.summary || '').trim();
    const likelyCause = String(parsed.likelyCause || parsed.cause || '').trim();
    const possibleFix = String(parsed.possibleFix || parsed.fix || '').trim();
    if (explanation || likelyCause || possibleFix) {
      return {
        explanation: explanation || SAFE_FALLBACK.explanation,
        likelyCause: likelyCause || SAFE_FALLBACK.likelyCause,
        possibleFix: possibleFix || SAFE_FALLBACK.possibleFix,
      };
    }
  }

  // Free-form fallback: use the whole reply as the explanation.
  return {
    explanation: raw || SAFE_FALLBACK.explanation,
    likelyCause: SAFE_FALLBACK.likelyCause,
    possibleFix: SAFE_FALLBACK.possibleFix,
  };
}

module.exports = {
  MAX_STDERR_CHARS,
  SAFE_FALLBACK,
  buildSystemPrompt,
  gateCompileErrorInput,
  buildUserPrompt,
  validateOutput,
  parseExplanation,
};
