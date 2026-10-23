/**
 * Deterministic educational-scope check for the AI Coach.
 * Runs on the user message and user history before Ollama or the sandbox.
 * Source code is not scanned, so identifiers in a program are not policy hits.
 */

const REFUSAL_MESSAGE =
  'I can help with coding, computer science, academic subjects, and studying. Please ask me an educational question.';

const CLARIFY_MESSAGE =
  'Please rephrase that as a coding, computer science, or academic study question.';

const STRUCTURED_ACTIONS = new Set([
  'EXPLAIN_CODE',
  'REVIEW',
  'COMPLEXITY',
  'COMPILE_ERROR',
  'WRONG_ANSWER',
  'OPTIMIZE',
  'HINT',
]);

const EXPLICIT = [
  /\bporn(?:ography|ographic)?\b/i,
  /\bhentai\b/i,
  /\berotic(?:a)?\b/i,
  /\bnsfw\b/i,
  /\bxxx\b/i,
  /\bonlyfans\b/i,
  /\b(?:sex|sexual)\s+(?:story|stories|scene|tape|video|chat)\b/i,
  /\b(?:erotic|sexual)\s+role[\s-]?play\b/i,
  /\brole[\s-]?play\b[\s\S]{0,48}\b(?:sex|nude|naked|erotic|porn)\b/i,
  /\b(?:nude|naked)\s+(?:pic|pics|photo|photos|picture|pictures|video)s?\b/i,
  /\b(?:jerk off|jack off|horny|blowjob|handjob|cumshot)\b/i,
  /\bpron\b/i,
  /\b(?:write|generate|send)\b[\s\S]{0,40}\b(?:dirty|vulgar|filthy)\b/i,
  /\b(?:dirty|vulgar|filthy)\s+(?:talk|story|joke|message|text)s?\b/i,
  /\b(?:swear|curse|cuss)\b[\s\S]{0,40}\b(?:at me|for fun|list|words)\b/i,
];

const JAILBREAK = [
  /\bignore\b[\s\S]{0,48}\b(?:rules|instructions|policy|policies|previous|prior)\b/i,
  /\b(?:jailbreak|developer mode|dan mode)\b/i,
  /\bpretend\b[\s\S]{0,48}\b(?:no restrictions|unfiltered|without rules)\b/i,
  /\bdo not follow\b[\s\S]{0,32}\b(?:rules|policy|instructions)\b/i,
  /\boverride\b[\s\S]{0,24}\b(?:policy|rules|instructions)\b/i,
];

const AMBIGUOUS_ADULT = /\b(?:sex|sexual|nude|naked|breast|penis|vagina|orgasm|intercourse)\b/i;

const EDUCATIONAL =
  /\b(?:biolog(?:y|ical)|anatom(?:y|ical)|physiolog(?:y|ical)|reproductive|reproduction|health|education|exam|homework|textbook|lecture|university|college|curriculum|meiosis|mitosis|gamete|chromosome|hormone|puberty|contraception|pregnancy|fertiliz(?:e|ation)|ovul\w*|sperm|ovum|uterus|menstrual|photosynthesis|newton|stoichiometr\w*|thermodynamics|quantum|calculus|algebra|geometr\w*|trigonometr\w*|theorem|proof|equation|integrat\w*|derivative|matrix|probabilit\w*|statistic\w*|physics|chemistr\w*|molecule|atom|cell|grammar|essay|thesis|stud(?:y|ying)|homework)\b/i;

const PROGRAMMING =
  /\b(?:code|coding|program(?:ming|mer)?|debug(?:ging)?|algorithm|algorithms|data\s*structures?|dsa|complexit(?:y|ies)|array|linked\s*list|binary\s*(?:search|tree)|graph|recursion|dynamic\s+programming|big-?o|python|c\+\+|javascript|function|variable|loop|compil(?:e|er|ation)|syntax|runtime|bug|exception|error|class|stack|queue|hash\s*map|pointer|leetcode|test\s*case|quicksort|dijkstra|sort(?:ing)?|search(?:ing)?|review|trace|verdict|editor|hint|optimi[sz]e)\b/i;

const CONTINUATION =
  /\b(?:continue|go on|keep going|write the rest|the rest of|as above|previous message|what i asked|that request|do that|do it)\b/i;

const CASUAL =
  /\b(?:weather|joke|celebrity|celebrities|recipe|movie|song)\b|\bhow are you\b/i;

/**
 * @param {string} text
 */
function normalize(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .toLowerCase();
}

/**
 * @param {string} text
 */
function rot13(text) {
  return text.replace(/[a-z]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String.fromCharCode(code < 110 ? code + 13 : code - 13);
  });
}

/**
 * @param {string} text
 */
function leet(text) {
  return text
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a');
}

/**
 * Prose outside fenced code blocks. Fenced source is not a policy surface.
 * @param {string} text
 */
function proseOutsideFences(text) {
  return String(text || '').replace(/```[\s\S]*?```/g, ' ');
}

/**
 * @param {string} trimmed
 */
function isCommentLine(trimmed) {
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    /^#(?!include\b)/.test(trimmed)
  );
}

/**
 * @param {string} trimmed
 */
function isCodeLine(trimmed) {
  if (
    /^(?:#include|using namespace|def |class |public |private |import |from |return |if \(|for \(|while \(|int |string |bool |cout|cin|printf|std::)/.test(
      trimmed,
    )
  ) {
    return true;
  }
  if (/[{};]/.test(trimmed) && /[=()<>]/.test(trimmed)) return true;
  if (/=\s*["'`]/.test(trimmed)) return true;
  return false;
}

/**
 * Drop source lines. Drop comments only when other prose remains, so a
 * comment cannot hide a request that is the whole message.
 * @param {string} text
 */
function stripCodeLines(text) {
  const lines = String(text || '').split('\n');
  const visible = lines
    .map((line) => line.trim())
    .filter((trimmed) => trimmed && !isCodeLine(trimmed));
  const dropComments = visible.some((trimmed) => !isCommentLine(trimmed));
  return visible.filter((trimmed) => !(dropComments && isCommentLine(trimmed))).join('\n');
}

/**
 * Prose is checked with leet, ROT13, and percent-decoding.
 * Fenced text is checked literally after code lines are removed, so a request
 * cannot hide in a fence and a string literal in source is not a request.
 * @param {string} text
 * @returns {{ variants: string[], surface: string }}
 */
function analyze(text) {
  const bounded = String(text || '').slice(0, 4000);
  let fenced = '';
  const prose = bounded.replace(/```[^\n]*\n?[\s\S]*?```/g, (block) => {
    fenced += `\n${block.replace(/```[^\n]*/g, ' ')}`;
    return '\n';
  });
  const surface = normalize(stripCodeLines(prose));
  /** @type {string[]} */
  const variants = [];
  if (surface) {
    variants.push(surface, leet(surface), rot13(surface));
    try {
      const decoded = decodeURIComponent(surface);
      if (decoded !== surface) variants.push(normalize(decoded));
    } catch {
      // Leave percent-encoded text as written.
    }
  }
  const fenceSurface = normalize(stripCodeLines(fenced));
  if (fenceSurface) variants.push(fenceSurface);
  const compact = bounded.replace(/\s+/g, '');
  if (
    compact.length >= 16 &&
    compact.length <= 4000 &&
    compact.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(compact)
  ) {
    const decoded = Buffer.from(compact, 'base64').toString('utf8');
    if (/^[\t\n\r\x20-\x7e]+$/.test(decoded)) variants.push(normalize(decoded));
  }
  if (variants.length === 0) variants.push('');
  return { variants, surface };
}

/**
 * @param {string} text
 */
function containsProhibitedRequest(text) {
  return analyze(text).variants.some(
    (item) => matchesAny(item, JAILBREAK) || matchesAny(item, EXPLICIT),
  );
}

/**
 * Remove comment lines that are themselves a prohibited request.
 * The surrounding educational request is kept. Source lines are kept.
 * @param {string} text
 */
function redactProhibitedAsides(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => !(isCommentLine(line.trim()) && containsProhibitedRequest(line)))
    .join('\n');
}

/**
 * @param {string} text
 */
function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * @param {string} text
 * @param {string} action
 * @returns {'allow'|'refuse'|'clarify'}
 */
function classifyText(text, action) {
  const { variants, surface } = analyze(text);
  if (variants.some((item) => matchesAny(item, JAILBREAK) || matchesAny(item, EXPLICIT))) {
    return 'refuse';
  }
  if (!surface.trim() && STRUCTURED_ACTIONS.has(action)) return 'allow';
  const educational = EDUCATIONAL.test(surface) || PROGRAMMING.test(surface);
  if (CASUAL.test(surface) && !educational) return 'refuse';
  if (AMBIGUOUS_ADULT.test(surface) && !educational) return 'clarify';
  if (educational) return 'allow';
  if (action === 'EXPLAIN_CODE' && /\bexplain\b/.test(surface)) return 'allow';
  return 'refuse';
}

/**
 * @param {{ action?: string, message?: string, history?: Array<{ role?: string, content?: string }> }} input
 * @returns {{ decision: 'allow'|'refuse'|'clarify', answer: string|null }}
 */
function isBareContinuation(message) {
  const surface = normalize(proseOutsideFences(message));
  if (!CONTINUATION.test(surface)) return false;
  if (PROGRAMMING.test(surface) || EDUCATIONAL.test(surface)) return false;
  return true;
}

function classifyCoachScope(input) {
  const action = typeof input.action === 'string' ? input.action : 'UNKNOWN';
  const message = typeof input.message === 'string' ? input.message : '';
  const history = Array.isArray(input.history) ? input.history : [];
  const current = classifyText(message, action);
  const priorUser = history.filter((turn) => turn && turn.role === 'user');

  if (current === 'refuse' && isBareContinuation(message)) {
    const last = priorUser.at(-1);
    const prior = last ? classifyText(last.content || '', 'UNKNOWN') : 'refuse';
    if (prior === 'allow') return { decision: 'allow', answer: null };
    return { decision: 'refuse', answer: REFUSAL_MESSAGE };
  }
  if (current === 'refuse') {
    return { decision: 'refuse', answer: REFUSAL_MESSAGE };
  }
  if (current === 'clarify') {
    return { decision: 'clarify', answer: CLARIFY_MESSAGE };
  }
  return { decision: 'allow', answer: null };
}

module.exports = {
  REFUSAL_MESSAGE,
  CLARIFY_MESSAGE,
  classifyCoachScope,
  classifyText,
  containsProhibitedRequest,
  redactProhibitedAsides,
};
