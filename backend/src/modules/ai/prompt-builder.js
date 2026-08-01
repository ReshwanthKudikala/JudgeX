/**
 * Central PromptBuilder for the Learning Coach.
 * Assembles system + user prompts from public context only.
 */

const fs = require('fs');
const path = require('path');

const { COACH_ACTIONS, resolveCoachAction } = require('./coach.actions');
const { sanitizePublicExamples } = require('./context-sanitizer');

const PROMPTS_DIR = path.join(__dirname, 'prompts');

const ACTION_PROMPT_FILES = Object.freeze({
  [COACH_ACTIONS.EXPLAIN_CODE]: 'explain-code.prompt.md',
  [COACH_ACTIONS.REVIEW]: 'review.prompt.md',
  [COACH_ACTIONS.COMPLEXITY]: 'complexity.prompt.md',
  [COACH_ACTIONS.COMPILE_ERROR]: 'compile-error.prompt.md',
  [COACH_ACTIONS.WRONG_ANSWER]: 'wrong-answer.prompt.md',
  [COACH_ACTIONS.OPTIMIZE]: 'optimize.prompt.md',
  [COACH_ACTIONS.HINT]: 'hint.prompt.md',
  [COACH_ACTIONS.UNKNOWN]: null,
});

/** @type {Map<string, string>} */
const templateCache = new Map();

function loadTemplate(filename) {
  if (!filename) return '';
  if (templateCache.has(filename)) return templateCache.get(filename);
  const full = path.join(PROMPTS_DIR, filename);
  const text = fs.readFileSync(full, 'utf8').trim();
  templateCache.set(filename, text);
  return text;
}

function truncate(text, max) {
  if (typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

function section(title, body) {
  if (!body || !String(body).trim()) return '';
  return `### ${title}\n${String(body).trim()}\n`;
}

/**
 * @typedef {object} CoachPromptContext
 * @property {string|CoachAction} action
 * @property {string} [language]
 * @property {string} [code]
 * @property {string} [message]
 * @property {object|null} [problem]
 * @property {object|null} [lastRunResult]
 * @property {object|null} [lastSubmission]
 * @property {number} [maxCodeChars]
 * @property {number} [maxStatementChars]
 * @property {number} [maxMessageChars]
 */

/**
 * @param {CoachPromptContext} ctx
 * @returns {{ action: string, system: string, user: string, meta: object }}
 */
function buildCoachPrompt(ctx) {
  const action = resolveCoachAction(ctx.action);
  const maxCode = ctx.maxCodeChars ?? 100_000;
  const maxStatement = ctx.maxStatementChars ?? 8_000;
  const maxMessage = ctx.maxMessageChars ?? 2_000;

  const systemParts = [loadTemplate('system.prompt.md')];
  const actionFile = ACTION_PROMPT_FILES[action];
  if (actionFile) {
    systemParts.push(loadTemplate(actionFile));
  } else {
    systemParts.push(
      '## Task: UNKNOWN\nAnswer the learner question using only the provided public context. Stay within coaching rules.',
    );
  }

  const problem = ctx.problem && typeof ctx.problem === 'object' ? ctx.problem : null;
  const examples = sanitizePublicExamples(problem?.examples);

  const userParts = [];

  if (problem) {
    userParts.push(
      section(
        'Problem',
        [
          problem.title ? `Title: ${problem.title}` : null,
          problem.difficulty ? `Difficulty: ${problem.difficulty}` : null,
          problem.statement
            ? `Description:\n${truncate(problem.statement, maxStatement)}`
            : null,
          problem.constraints
            ? `Constraints:\n${truncate(problem.constraints, maxStatement)}`
            : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
    );
  }

  if (examples.length > 0) {
    const exampleText = examples
      .map((ex, i) => {
        const bits = [`Example ${i + 1}:`, `Input:\n${ex.input}`, `Output:\n${ex.output}`];
        if (ex.explanation) bits.push(`Explanation:\n${ex.explanation}`);
        return bits.join('\n');
      })
      .join('\n\n');
    userParts.push(section('Public examples (samples only)', exampleText));
  }

  if (ctx.language) {
    userParts.push(section('Language', ctx.language));
  }

  if (ctx.code) {
    userParts.push(
      section(
        'Current source code',
        `\`\`\`${ctx.language || ''}\n${truncate(ctx.code, maxCode)}\n\`\`\``,
      ),
    );
  }

  if (ctx.lastRunResult) {
    userParts.push(
      section(
        'Latest Run result (public samples only)',
        JSON.stringify(ctx.lastRunResult, null, 2),
      ),
    );
  }

  if (ctx.lastSubmission) {
    userParts.push(
      section(
        'Latest Submit summary (no hidden case I/O)',
        JSON.stringify(ctx.lastSubmission, null, 2),
      ),
    );
  }

  const compileBits = [];
  if (ctx.lastRunResult?.compile?.stderr) {
    compileBits.push(String(ctx.lastRunResult.compile.stderr));
  }
  if (ctx.lastRunResult?.stderr) {
    compileBits.push(String(ctx.lastRunResult.stderr));
  }
  if (ctx.lastSubmission?.compileOutput) {
    compileBits.push(String(ctx.lastSubmission.compileOutput));
  }
  if (ctx.lastSubmission?.executionError) {
    compileBits.push(String(ctx.lastSubmission.executionError));
  }
  if (compileBits.length) {
    userParts.push(section('Compile / runtime information', truncate(compileBits.join('\n'), 4000)));
  }

  userParts.push(section('Selected action', action));

  if (ctx.message) {
    userParts.push(section('User question', truncate(ctx.message, maxMessage)));
  }

  userParts.push(
    section(
      'Security note',
      'Hidden judge tests are not included and must not be invented or discussed as known inputs/outputs.',
    ),
  );

  return {
    action,
    system: systemParts.join('\n\n'),
    user: userParts.filter(Boolean).join('\n'),
    meta: {
      hasProblem: Boolean(problem),
      exampleCount: examples.length,
      hasRun: Boolean(ctx.lastRunResult),
      hasSubmission: Boolean(ctx.lastSubmission),
      codeChars: typeof ctx.code === 'string' ? ctx.code.length : 0,
    },
  };
}

/** Test helper */
function clearPromptTemplateCache() {
  templateCache.clear();
}

module.exports = {
  buildCoachPrompt,
  clearPromptTemplateCache,
  ACTION_PROMPT_FILES,
};
