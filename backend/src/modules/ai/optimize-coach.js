/**
 * Sprint 46 — Optimization Coach helpers.
 */

const { COACH_ACTIONS } = require('./coach.actions');

const EMPTY_OPTIMIZE_CODE_MESSAGE =
  'Write some code in the editor first, then click “Optimize My Solution”.';

const OPTIMIZE_SECTIONS = Object.freeze([
  'Current Solution',
  'Complexity Analysis',
  'Can It Be Improved?',
  'Alternative Approaches',
  'Scalability',
  'Interview Perspective',
  'Optimization Tips',
]);

/**
 * Compact optional runtime/memory from public run/submit for prompts.
 * @param {{ lastRunResult?: object|null, lastSubmission?: object|null }} ctx
 */
function buildOptimizePerfContext(ctx) {
  const run = ctx.lastRunResult && typeof ctx.lastRunResult === 'object' ? ctx.lastRunResult : null;
  const sub =
    ctx.lastSubmission && typeof ctx.lastSubmission === 'object' ? ctx.lastSubmission : null;

  const out = {};
  if (run) {
    if (typeof run.status === 'string') out.runStatus = run.status;
    if (typeof run.passedCount === 'number') out.passedCount = run.passedCount;
    if (typeof run.totalCount === 'number') out.totalCount = run.totalCount;
  }
  if (sub) {
    if (typeof sub.verdict === 'string') out.verdict = sub.verdict;
    if (sub.runtimeMs != null) out.runtimeMs = sub.runtimeMs;
    if (sub.memoryKb != null) out.memoryKb = sub.memoryKb;
    if (typeof sub.passedTests === 'number') out.passedTests = sub.passedTests;
    if (typeof sub.totalTests === 'number') out.totalTests = sub.totalTests;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * @param {string} raw
 * @param {{ action?: string }} [opts]
 */
function mapOptimizeMarkdownAnswer(raw, opts = {}) {
  let text = typeof raw === 'string' ? raw.trim() : '';

  const outerFence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (outerFence) {
    text = outerFence[1].trim();
  }

  text = text.replace(/^#{1,3}\s*Current Solution\s*$/im, '# Current Solution');
  text = text.replace(/^#{1,3}\s*Can It Be Improved\??\s*$/im, '# Can It Be Improved?');

  const sectionsFound = OPTIMIZE_SECTIONS.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^#{1,3}\\s*${escaped}\\s*$`, 'im');
    return re.test(text);
  });

  if (opts.action === COACH_ACTIONS.OPTIMIZE && !text.startsWith('#')) {
    text = `# Current Solution\n\n${text}`;
  }

  return {
    answer: text,
    format: 'markdown',
    sectionsFound,
  };
}

module.exports = {
  EMPTY_OPTIMIZE_CODE_MESSAGE,
  OPTIMIZE_SECTIONS,
  buildOptimizePerfContext,
  mapOptimizeMarkdownAnswer,
};
