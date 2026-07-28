/**
 * Demo / portfolio problem catalog (content only).
 * Used by seed-demo-problems.js and integration fixtures.
 * Schema / API / frontend are unchanged — this is data.
 *
 * Each problem has:
 * - samples: public (is_hidden = false) — shown on the problem page / Run
 * - hiddenTests: judge-only (is_hidden = true) — Submit only
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
  /** Judge-only cases (is_hidden = true). Expected indices = unique valid pair (smaller index first). */
  hiddenTests: [
    // Minimum length
    { input: '2\n1 2\n3\n', expectedOutput: '0 1\n' },
    // Negatives: -2 + -4 = -6
    { input: '4\n-1 -2 -3 -4\n-6\n', expectedOutput: '1 3\n' },
    // Mixed signs: -10 + 5 = -5
    { input: '5\n-10 0 5 20 3\n-5\n', expectedOutput: '0 2\n' },
    // Zeros summing to zero
    { input: '4\n0 4 3 0\n0\n', expectedOutput: '0 3\n' },
    // Mid-array pair: 3 + 4 = 7
    { input: '6\n8 1 2 3 4 -1\n7\n', expectedOutput: '3 4\n' },
    // Large magnitude values
    { input: '3\n1000000000 -1000000000 5\n0\n', expectedOutput: '0 1\n' },
    // Duplicate values, distinct indices
    { input: '5\n5 5 5 5 1\n10\n', expectedOutput: '0 1\n' },
    // Target equals twice a mid-array value
    { input: '4\n1 4 4 2\n8\n', expectedOutput: '1 2\n' },
    // Later pair: 8 + 1 = 9
    { input: '7\n10 15 3 7 8 1 2\n9\n', expectedOutput: '4 5\n' },
    // Two equal positives that sum with a negative elsewhere: -50 + 50 = 0
    { input: '3\n-50 50 50\n0\n', expectedOutput: '0 1\n' },
    // Longer sparse array: 13 + 17 = 30
    { input: '10\n1 3 5 7 9 11 13 15 17 19\n30\n', expectedOutput: '6 8\n' },
    // Early hit: 9 + 1 = 10
    { input: '5\n9 1 8 2 7\n10\n', expectedOutput: '0 1\n' },
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
  hiddenTests: [
    { input: '0 0\n', expectedOutput: '0\n' },
    { input: '-1 -1\n', expectedOutput: '-2\n' },
    { input: '1000000000 1000000000\n', expectedOutput: '2000000000\n' },
    { input: '-1000000000 1000000000\n', expectedOutput: '0\n' },
    { input: '-1000000000 -1000000000\n', expectedOutput: '-2000000000\n' },
    { input: '999999999 1\n', expectedOutput: '1000000000\n' },
    { input: '42 0\n', expectedOutput: '42\n' },
    { input: '0 -42\n', expectedOutput: '-42\n' },
    { input: '123456789 987654321\n', expectedOutput: '1111111110\n' },
    { input: '-7 7\n', expectedOutput: '0\n' },
    { input: '1 -1000000000\n', expectedOutput: '-999999999\n' },
    { input: '2147483647 1\n', expectedOutput: '2147483648\n' },
    { input: '-2147483648 0\n', expectedOutput: '-2147483648\n' },
    { input: '100 -50\n', expectedOutput: '50\n' },
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
  hiddenTests: [
    // Requested / classic edges
    { input: '0\n', expectedOutput: 'true\n' },
    { input: '1\n', expectedOutput: 'true\n' },
    { input: '11\n', expectedOutput: 'true\n' },
    { input: '22\n', expectedOutput: 'true\n' },
    { input: '101\n', expectedOutput: 'true\n' },
    { input: '1001\n', expectedOutput: 'true\n' },
    { input: '12321\n', expectedOutput: 'true\n' },
    { input: '1000000001\n', expectedOutput: 'true\n' },
    { input: '2147447412\n', expectedOutput: 'true\n' },
    { input: '2147483647\n', expectedOutput: 'false\n' },
    { input: '100\n', expectedOutput: 'false\n' },
    { input: '1000\n', expectedOutput: 'false\n' },
    { input: '10010\n', expectedOutput: 'false\n' },
    { input: '999999999\n', expectedOutput: 'true\n' },
    // Extra corner / boundary coverage
    { input: '-1\n', expectedOutput: 'false\n' },
    { input: '-2147483648\n', expectedOutput: 'false\n' },
    { input: '12\n', expectedOutput: 'false\n' },
    { input: '1221\n', expectedOutput: 'true\n' },
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
