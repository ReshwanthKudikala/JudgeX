/**
 * Demo / portfolio problem catalog (content only).
 * Used by seed-demo-problems.js and integration fixtures.
 * Schema / API / frontend are unchanged — this is data.
 */

const TWO_SUM = {
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'easy',
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  statement: [
    'Given an array of integers `nums` and an integer `target`, return the **indices** of the two numbers that add up to `target`.',
    '',
    'You may assume that each input has **exactly one** solution, and you may not use the same element twice.',
    '',
    'You can return the answer in any order.',
    '',
    '## Input format',
    '',
    '- The first line contains an integer `n` — the length of the array (`2 ≤ n ≤ 10^4`).',
    '- The second line contains `n` space-separated integers `nums[i]` (`-10^9 ≤ nums[i] ≤ 10^9`).',
    '- The third line contains an integer `target` (`-10^9 ≤ target ≤ 10^9`).',
    '',
    '## Output format',
    '',
    'Print two space-separated integers — the indices `i` and `j` (`0`-based) such that `nums[i] + nums[j] = target`.',
    '',
    '## Notes',
    '',
    '- Indices are **0-based**.',
    '- Either order of the two indices is accepted when both are correct.',
  ].join('\n'),
  constraintsText: [
    '- 2 ≤ n ≤ 10^4',
    '- -10^9 ≤ nums[i] ≤ 10^9',
    '- -10^9 ≤ target ≤ 10^9',
    '- Exactly one valid pair exists',
    '- You may not use the same index twice',
  ].join('\n'),
  samples: [
    {
      input: '4\n2 7 11 15\n9\n',
      expectedOutput: '0 1\n',
      explanation: 'nums[0] + nums[1] = 2 + 7 = 9, so indices 0 and 1 are returned.',
    },
    {
      input: '3\n3 2 4\n6\n',
      expectedOutput: '1 2\n',
      explanation: 'nums[1] + nums[2] = 2 + 4 = 6.',
    },
    {
      input: '2\n3 3\n6\n',
      expectedOutput: '0 1\n',
      explanation: 'The only pair is the two elements at indices 0 and 1.',
    },
  ],
};

const A_PLUS_B = {
  slug: 'a-plus-b',
  title: 'A + B',
  difficulty: 'easy',
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  statement: [
    'You are given two integers `a` and `b`. Compute their sum.',
    '',
    'This is a warm-up problem to verify that your environment can read input and print output correctly.',
    '',
    '## Input format',
    '',
    'A single line containing two space-separated integers `a` and `b`.',
    '',
    '## Output format',
    '',
    'Print a single integer — the value of `a + b`.',
  ].join('\n'),
  constraintsText: [
    '- -10^9 ≤ a, b ≤ 10^9',
    '- The sum fits in a signed 64-bit integer',
  ].join('\n'),
  samples: [
    {
      input: '1 2\n',
      expectedOutput: '3\n',
      explanation: '1 + 2 = 3.',
    },
    {
      input: '10 20\n',
      expectedOutput: '30\n',
      explanation: '10 + 20 = 30.',
    },
    {
      input: '-5 8\n',
      expectedOutput: '3\n',
      explanation: '-5 + 8 = 3.',
    },
  ],
};

const PALINDROME_NUMBER = {
  slug: 'palindrome-number',
  title: 'Palindrome Number',
  difficulty: 'easy',
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  statement: [
    'Given an integer `x`, return whether it is a **palindrome**.',
    '',
    'An integer is a palindrome when it reads the same forward and backward.',
    '',
    'For example, `121` is a palindrome while `123` is not. Negative numbers are **not** palindromes.',
    '',
    '## Input format',
    '',
    'A single line containing one integer `x`.',
    '',
    '## Output format',
    '',
    'Print `true` if `x` is a palindrome, otherwise print `false` (lowercase).',
  ].join('\n'),
  constraintsText: [
    '- -2^31 ≤ x ≤ 2^31 - 1',
    '- Do not convert the integer to a string if you want an extra challenge (optional)',
  ].join('\n'),
  samples: [
    {
      input: '121\n',
      expectedOutput: 'true\n',
      explanation: '121 reads the same forwards and backwards.',
    },
    {
      input: '-121\n',
      expectedOutput: 'false\n',
      explanation: 'From left to right it is -121; from right to left it becomes 121-. Not a palindrome.',
    },
    {
      input: '10\n',
      expectedOutput: 'false\n',
      explanation: '10 backwards is 01, which is 1 — not equal to 10.',
    },
  ],
};

/** Ordered catalog of demo problems. */
const DEMO_PROBLEMS = [TWO_SUM, A_PLUS_B, PALINDROME_NUMBER];

module.exports = {
  DEMO_PROBLEMS,
  TWO_SUM,
  A_PLUS_B,
  PALINDROME_NUMBER,
};
