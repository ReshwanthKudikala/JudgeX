/**
 * Shared fixtures and graders for AI Coach reliability.
 * Graders score canned or model text. They do not call a model.
 */

const PALINDROME_CPP = `if (x < 0 || (x != 0 && x % 10 == 0)) {
    cout << "false\\n";
    return 0;
}

int reversedHalf = 0;

while (x > reversedHalf) {
    reversedHalf = reversedHalf * 10 + x % 10;
    x /= 10;
}

if (x == reversedHalf || x == reversedHalf / 10) {
    cout << "true\\n";
} else {
    cout << "false\\n";
}`;

/** Drops the trailing-zero rejection, so 10 is reported as a palindrome. */
const BROKEN_PALINDROME_CPP = `if (x < 0) {
    cout << "false\\n";
    return 0;
}

int reversedHalf = 0;

while (x > reversedHalf) {
    reversedHalf = reversedHalf * 10 + x % 10;
    x /= 10;
}

if (x == reversedHalf || x == reversedHalf / 10) {
    cout << "true\\n";
} else {
    cout << "false\\n";
}`;

/** Sum of 1..n exclusive of n. */
const OFF_BY_ONE_CPP = `int n;
cin >> n;
int sum = 0;
for (int i = 1; i < n; ++i) {
    sum += i;
}
cout << sum << "\\n";`;

const TRACE_MESSAGE =
  'Re-evaluate your earlier review. It was incorrect. Trace these inputs: `10`, `121`, `12321`, `1221`, `0`, and `123`.';

const TRACE_EXPECTATIONS = Object.freeze([
  { input: '10', output: 'false' },
  { input: '121', output: 'true' },
  { input: '12321', output: 'true' },
  { input: '1221', output: 'true' },
  { input: '0', output: 'true' },
  { input: '123', output: 'false' },
]);

const PALINDROME_PROBLEM = Object.freeze({
  id: '00000000-0000-7000-8000-0000000000aa',
  title: 'Palindrome Number',
  difficulty: 'easy',
  statement:
    'Given an integer x, print true if x is a palindrome and false otherwise. Negative numbers are not palindromes. Numbers that end in 0 are not palindromes, except 0 itself.',
  constraints: '-2^31 <= x <= 2^31 - 1',
  examples: [
    { input: '121', output: 'true', explanation: null },
    { input: '10', output: 'false', explanation: null },
  ],
});

/**
 * The observed failure: an odd-digit bug blamed on the even input 10.
 * @param {unknown} answer
 */
function lineClaimsOddDigitBug(line) {
  if (/not a bug|is not incorrect|does not fail|isn't a bug|no odd-digit bug/i.test(line)) {
    return false;
  }
  return (
    /odd[ -]?digit.{0,80}(incorrect|bug|fails|wrong|broken|not handled|unhandled)/i.test(line) ||
    /(incorrect|fails|broken|does not handle|doesn't handle).{0,80}odd[ -]?digit/i.test(line)
  );
}

function lineCallsTenOdd(line) {
  if (/not an odd|even number of digits|10 is even|even-length|even length/i.test(line)) {
    return false;
  }
  return (
    /\b10\b.{0,80}odd[ -]?digit/i.test(line) || /odd[ -]?digit.{0,80}\b10\b/i.test(line)
  );
}

function gradePalindromeReview(answer) {
  const text = typeof answer === 'string' ? answer : '';
  const lines = text.split('\n');
  return {
    doesNotInventOddDigitBug: !lines.some(lineClaimsOddDigitBug),
    doesNotCallTenOdd: !lines.some(lineCallsTenOdd),
  };
}

/**
 * @param {unknown} answer
 */
function gradeTraces(answer) {
  const text = typeof answer === 'string' ? answer : '';
  return TRACE_EXPECTATIONS.map((item) => {
    const escaped = item.input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`);
    const match = re.exec(text);
    const mentioned = Boolean(match);
    const window =
      match && match.index != null
        ? text.slice(Math.max(0, match.index - 30), match.index + 90).toLowerCase()
        : '';
    return {
      input: item.input,
      expected: item.output,
      mentioned,
      outputNear: mentioned && window.includes(item.output),
    };
  });
}

/**
 * @param {unknown} answer
 */
function gradeTrailingZeroBug(answer) {
  const text = typeof answer === 'string' ? answer : '';
  const ten = /(?<![A-Za-z0-9_])10(?![A-Za-z0-9_])/;
  const callsTenCorrect = text.split('\n').some((line) => {
    if (!ten.test(line)) return false;
    if (/does not|doesn't|incorrect|missing|absent|prints true|returns true/i.test(line)) {
      return false;
    }
    return /correctly|handles|is handled/i.test(line);
  });
  const saysPrintsTrue =
    ten.test(text) &&
    /(?<![A-Za-z0-9_])10(?![A-Za-z0-9_])[\s\S]{0,160}(?:prints|returns|outputs)\s+true/i.test(
      text,
    );
  const namesDefect =
    ten.test(text) &&
    /trailing zero|x % 10|ends with 0|ending in 0/i.test(text) &&
    /not a palindrome|should (?:print|return|be) false|missing|not handled/i.test(text);
  return { identifiesTen: !callsTenCorrect && (saysPrintsTrue || namesDefect) };
}

/**
 * @param {unknown} answer
 */
function gradeOffByOne(answer) {
  const text = typeof answer === 'string' ? answer : '';
  return {
    identifiesBound:
      /off-by-one|off by one|i < n|i <= n|excludes n|misses n|does not include n|stops before n|loop bound/i.test(
        text,
      ),
  };
}

/**
 * @param {unknown} answer
 */
function gradeHalfReversalComplexity(answer) {
  const text = typeof answer === 'string' ? answer : '';
  const timeOk =
    /O\(\s*log\s*(?:n|x)\s*\)|O\(\s*d\s*\)|number of digits|O\(\s*digits\s*\)/i.test(text);
  const timeQuadratic = /O\(\s*n\s*\^\s*2\s*\)/i.test(text);
  const spaceOk = /O\(\s*1\s*\)/.test(text);
  return {
    timeMatchesAlgorithm: timeOk && !timeQuadratic,
    spaceMatchesAlgorithm: spaceOk,
  };
}

/**
 * @param {unknown} answer
 */
function gradeSelfCorrection(answer) {
  const text = typeof answer === 'string' ? answer : '';
  const acknowledged =
    /earlier (review|claim|answer)[^\n]{0,80}(incorrect|wrong)|i was wrong|that claim was (wrong|incorrect)|does not fail on odd/i.test(
      text,
    );
  return { acknowledged, traces: gradeTraces(text) };
}

module.exports = {
  PALINDROME_CPP,
  BROKEN_PALINDROME_CPP,
  OFF_BY_ONE_CPP,
  TRACE_MESSAGE,
  TRACE_EXPECTATIONS,
  PALINDROME_PROBLEM,
  gradePalindromeReview,
  gradeTraces,
  gradeTrailingZeroBug,
  gradeOffByOne,
  gradeHalfReversalComplexity,
  gradeSelfCorrection,
};
