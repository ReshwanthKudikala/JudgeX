// Three-layer AI guardrails (ARCHITECTURE.md §9.3).
// Layer 1: input gate — server assembles the prompt; strip junk / bound size.
// Layer 2: system-prompt contract — coach, never solve (unless explicitly allowed).
// Layer 3: output validation — redact / block solution-like replies.

const MAX_STDERR_CHARS = 4000;
const MAX_CODE_CHARS = 12_000;
const MAX_MESSAGE_CHARS = 2000;
const MAX_STATEMENT_CHARS = 4000;
const MAX_CODE_FENCE_LINES = 12;

const SAFE_FALLBACK = {
  explanation:
    'The compiler reported an error in your source. Check the reported line and nearby syntax (brackets, punctuation, types, and declarations).',
  likelyCause: 'A syntax or type error near the location indicated by the compiler message.',
  possibleFix:
    'Re-read the compiler message, fix the indicated construct, and recompile. Do not replace your whole program with an unrelated solution.',
};

const VERDICT_FALLBACK = {
  explanation: 'Your submission did not pass. Review the verdict details and carefully re-check edge cases and constraints.',
  likelyCause: 'A logic error, edge-case miss, or resource limit issue relative to the problem constraints.',
  possibleFix: 'Re-read the problem statement, add focused tests for edge cases, and refine the approach without rewriting from a full solution.',
};

const HINT_LABELS = Object.freeze({
  1: 'General direction',
  2: 'Algorithm',
  3: 'Data structure',
  4: 'Almost complete guidance',
});

/**
 * Layer 2 — fixed system prompt for compile-error explanations.
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

function buildLearningSystemPrompt({ revealSolution = false } = {}) {
  const base = [
    'You are a programming learning assistant for JudgeX.',
    'Be a coach: teach reasoning, diagnosis, and incremental improvement.',
    'Prefer short, structured answers.',
  ];

  if (revealSolution) {
    base.push(
      'The user EXPLICITLY requested a full solution. You MAY provide a complete working solution with explanation.',
      'Still keep the solution clear and educational.',
    );
  } else {
    base.push(
      'NEVER provide a complete solution, a full corrected program, or copy-pasteable working code that solves the problem.',
      'NEVER rewrite the user\'s entire source file.',
      'You MAY mention tiny illustrative snippets (a few tokens / one short line) but not multi-line solutions.',
    );
  }

  base.push(
    'Respond with ONLY a JSON object with keys:',
    '  "reply" — main coaching response (markdown allowed inside the string),',
    '  "summary" — one-sentence takeaway,',
    '  "timeComplexity" — optional Big-O estimate or null,',
    '  "spaceComplexity" — optional Big-O estimate or null,',
    '  "hintLevel" — optional integer 1-4 when giving a progressive hint, else null.',
    'No markdown fences around the JSON. No extra keys.',
  );

  return base.join(' ');
}

/**
 * Layer 1 — gate/sanitize inputs the model is allowed to see.
 * @param {{ language: string, compileOutput: string }} input
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

function gateLanguage(language) {
  const lang = String(language || '').trim().toLowerCase();
  if (lang !== 'python' && lang !== 'cpp') {
    throw new Error('Unsupported language. Use python or cpp.');
  }
  return lang;
}

function gateCode(sourceCode) {
  let code = String(sourceCode || '').replace(/\0/g, '');
  if (!code.trim()) {
    throw new Error('Source code is required.');
  }
  if (code.length > MAX_CODE_CHARS) {
    code = `${code.slice(0, MAX_CODE_CHARS)}\n…[truncated]`;
  }
  return code;
}

function gateMessage(message) {
  let text = String(message || '').replace(/\0/g, '').trim();
  if (!text) {
    throw new Error('A message is required.');
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    text = `${text.slice(0, MAX_MESSAGE_CHARS)}…[truncated]`;
  }
  return text;
}

function gateStatement(statement) {
  let text = String(statement || '').replace(/\0/g, '').trim();
  if (text.length > MAX_STATEMENT_CHARS) {
    text = `${text.slice(0, MAX_STATEMENT_CHARS)}\n…[truncated]`;
  }
  return text;
}

function gateHintLevel(level) {
  const n = Number(level);
  if (![1, 2, 3, 4].includes(n)) {
    throw new Error('hintLevel must be 1, 2, 3, or 4.');
  }
  return n;
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

function buildVerdictUserPrompt({
  language,
  verdict,
  compileOutput,
  stderr,
  stdout,
  sourceCode,
  problemTitle,
  statement,
}) {
  return [
    `Task: explain why this submission failed (${verdict}).`,
    `Language: ${language}`,
    `Verdict: ${verdict}`,
    problemTitle ? `Problem: ${problemTitle}` : null,
    statement ? `Problem statement (truncated):\n---\n${statement}\n---` : null,
    sourceCode ? `User code:\n---\n${sourceCode}\n---` : null,
    compileOutput ? `Compile output:\n---\n${compileOutput}\n---` : null,
    stderr ? `Stderr:\n---\n${stderr}\n---` : null,
    stdout ? `Stdout:\n---\n${stdout}\n---` : null,
    'Respond as JSON with keys reply, summary, timeComplexity, spaceComplexity, hintLevel.',
    'Do NOT provide a full solution.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildComplexityUserPrompt({ language, sourceCode, problemTitle, statement }) {
  return [
    'Task: estimate time and space complexity of the user approach.',
    `Language: ${language}`,
    problemTitle ? `Problem: ${problemTitle}` : null,
    statement ? `Problem statement (truncated):\n---\n${statement}\n---` : null,
    `User code:\n---\n${sourceCode}\n---`,
    'Respond as JSON with keys reply, summary, timeComplexity, spaceComplexity, hintLevel.',
    'Do NOT provide a full rewrite/solution.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildOptimizationUserPrompt({ language, sourceCode, problemTitle, statement }) {
  return [
    'Task: suggest optimization directions for the user code.',
    `Language: ${language}`,
    problemTitle ? `Problem: ${problemTitle}` : null,
    statement ? `Problem statement (truncated):\n---\n${statement}\n---` : null,
    `User code:\n---\n${sourceCode}\n---`,
    'Focus on algorithmic and data-structure improvements, not a full rewrite.',
    'Respond as JSON with keys reply, summary, timeComplexity, spaceComplexity, hintLevel.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildHintUserPrompt({ hintLevel, problemTitle, statement, difficulty }) {
  const label = HINT_LABELS[hintLevel] || `Hint ${hintLevel}`;
  return [
    `Task: give progressive hint level ${hintLevel} (${label}).`,
    problemTitle ? `Problem: ${problemTitle}` : null,
    difficulty ? `Difficulty: ${difficulty}` : null,
    statement ? `Problem statement (truncated):\n---\n${statement}\n---` : null,
    'Hint ladder:',
    '1 = general direction only,',
    '2 = name/outline the algorithm family,',
    '3 = suggest a suitable data structure,',
    '4 = nearly complete guidance without full code.',
    'Do NOT give the full solution.',
    'Respond as JSON with keys reply, summary, timeComplexity, spaceComplexity, hintLevel.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildAssistantUserPrompt({
  action,
  language,
  sourceCode,
  message,
  problemTitle,
  statement,
  verdict,
  revealSolution,
}) {
  return [
    `Task: ${action}`,
    language ? `Language: ${language}` : null,
    problemTitle ? `Problem: ${problemTitle}` : null,
    verdict ? `Latest verdict: ${verdict}` : null,
    statement ? `Problem statement (truncated):\n---\n${statement}\n---` : null,
    sourceCode ? `User code:\n---\n${sourceCode}\n---` : null,
    message ? `User message:\n${message}` : null,
    revealSolution
      ? 'The user explicitly requested a full solution. You may provide one.'
      : 'Do NOT provide a full solution unless the task is explicitly reveal_solution.',
    'Respond as JSON with keys reply, summary, timeComplexity, spaceComplexity, hintLevel.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Layer 3 — detect responses that look like a full solution.
 * @param {string} text
 * @param {{ allowSolution?: boolean }} [options]
 */
function validateOutput(text, options = {}) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { ok: false, text: '', wasBlocked: true };
  }

  if (options.allowSolution) {
    return { ok: true, text: raw, wasBlocked: false };
  }

  const fenceMatch = raw.match(/```[\s\S]*?```/g) || [];
  for (const block of fenceMatch) {
    const lines = block.split('\n').length;
    if (lines > MAX_CODE_FENCE_LINES) {
      return { ok: false, text: raw, wasBlocked: true };
    }
  }

  const codeLike = (raw.match(/^\s*(def |class |#include|int main\s*\()/gm) || []).length;
  if (codeLike >= 3 && raw.length > 800) {
    return { ok: false, text: raw, wasBlocked: true };
  }

  return { ok: true, text: raw, wasBlocked: false };
}

/**
 * Parse model text into the structured explanation shape.
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
    const explanation = String(parsed.explanation || parsed.summary || parsed.reply || '').trim();
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

  return {
    explanation: raw || SAFE_FALLBACK.explanation,
    likelyCause: SAFE_FALLBACK.likelyCause,
    possibleFix: SAFE_FALLBACK.possibleFix,
  };
}

function parseLearningReply(text) {
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
    const reply = String(parsed.reply || parsed.explanation || parsed.summary || '').trim();
    const summary = String(parsed.summary || '').trim();
    const timeComplexity = parsed.timeComplexity != null
      ? String(parsed.timeComplexity).trim() || null
      : null;
    const spaceComplexity = parsed.spaceComplexity != null
      ? String(parsed.spaceComplexity).trim() || null
      : null;
    let hintLevel = null;
    if (parsed.hintLevel != null && parsed.hintLevel !== '') {
      const n = Number(parsed.hintLevel);
      if ([1, 2, 3, 4].includes(n)) hintLevel = n;
    }

    if (reply || summary) {
      return {
        reply: reply || summary || VERDICT_FALLBACK.explanation,
        summary: summary || reply.slice(0, 140) || VERDICT_FALLBACK.likelyCause,
        timeComplexity,
        spaceComplexity,
        hintLevel,
      };
    }
  }

  return {
    reply: raw || VERDICT_FALLBACK.explanation,
    summary: VERDICT_FALLBACK.likelyCause,
    timeComplexity: null,
    spaceComplexity: null,
    hintLevel: null,
  };
}

const BLOCKED_LEARNING_FALLBACK = {
  reply:
    'I can help you reason about the approach, but I cannot share a full solution here. Ask for a smaller hint, complexity analysis, or an explanation of your verdict.',
  summary: 'Full solutions are blocked by safety guardrails.',
  timeComplexity: null,
  spaceComplexity: null,
  hintLevel: null,
};

module.exports = {
  MAX_STDERR_CHARS,
  MAX_CODE_CHARS,
  SAFE_FALLBACK,
  VERDICT_FALLBACK,
  HINT_LABELS,
  BLOCKED_LEARNING_FALLBACK,
  buildSystemPrompt,
  buildLearningSystemPrompt,
  gateCompileErrorInput,
  gateLanguage,
  gateCode,
  gateMessage,
  gateStatement,
  gateHintLevel,
  buildUserPrompt,
  buildVerdictUserPrompt,
  buildComplexityUserPrompt,
  buildOptimizationUserPrompt,
  buildHintUserPrompt,
  buildAssistantUserPrompt,
  validateOutput,
  parseExplanation,
  parseLearningReply,
};
