/**
 * Sprint 47 — Compile Error coach helpers (unified AI Coach path).
 */

const { COACH_ACTIONS } = require('./coach.actions');

const COMPILE_ERROR_SECTIONS = Object.freeze([
  'Likely Cause',
  'Explanation',
  'Possible Fix',
  'Learning Tip',
]);

/**
 * @param {unknown} statusOrVerdict
 */
function isCompileErrorVerdict(statusOrVerdict) {
  if (typeof statusOrVerdict !== 'string') return false;
  const v = statusOrVerdict.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return v === 'compile_error' || v === 'compilation_error';
}

/**
 * @param {{ lastRunResult?: object|null, lastSubmission?: object|null }} ctx
 */
function hasCompileErrorContext(ctx) {
  const run = ctx.lastRunResult && typeof ctx.lastRunResult === 'object' ? ctx.lastRunResult : null;
  const sub =
    ctx.lastSubmission && typeof ctx.lastSubmission === 'object' ? ctx.lastSubmission : null;

  if (run) {
    if (isCompileErrorVerdict(run.status)) return true;
    if (run.compileSuccess === false) return true;
    if (typeof run.stderr === 'string' && run.stderr.trim()) {
      // Prefer explicit status; stderr alone is weak signal — still allow if compile flagged.
      if (run.compile?.success === false) return true;
    }
  }
  if (sub) {
    if (isCompileErrorVerdict(sub.verdict) || isCompileErrorVerdict(sub.status)) return true;
    if (typeof sub.compileOutput === 'string' && sub.compileOutput.trim()) {
      if (isCompileErrorVerdict(sub.verdict)) return true;
    }
  }
  return false;
}

/**
 * @param {string} raw
 * @param {{ action?: string }} [opts]
 */
function mapCompileErrorMarkdownAnswer(raw, opts = {}) {
  let text = typeof raw === 'string' ? raw.trim() : '';

  const outerFence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (outerFence) {
    text = outerFence[1].trim();
  }

  text = text.replace(/^#{1,3}\s*Likely Cause\s*$/im, '# Likely Cause');

  const sectionsFound = COMPILE_ERROR_SECTIONS.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^#{1,3}\\s*${escaped}\\s*$`, 'im');
    return re.test(text);
  });

  if (opts.action === COACH_ACTIONS.COMPILE_ERROR && !text.startsWith('#')) {
    text = `# Likely Cause\n\n${text}`;
  }

  return {
    answer: text,
    format: 'markdown',
    sectionsFound,
  };
}

module.exports = {
  COMPILE_ERROR_SECTIONS,
  isCompileErrorVerdict,
  hasCompileErrorContext,
  mapCompileErrorMarkdownAnswer,
};
