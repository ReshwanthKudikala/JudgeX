/**
 * High-quality static editorials for demo problems (Sprint 40).
 * Teach approaches — do not dump full source solutions.
 */

const TWO_SUM_MARKDOWN = `# Intuition

You are given an array of integers and a target sum. Exactly one pair of numbers adds up to that target. The goal is to return their indices — not the values themselves.

The key insight is that for every number \`x\` you see, the other number you need is \`target - x\`. If you can remember which indices you have already seen, you can answer the question in a single pass.

# Brute Force

Check every pair \`(i, j)\` with \`i < j\` and test whether \`nums[i] + nums[j] === target\`.

- Nested loops over all ordered pairs.
- Correct, but does more work than necessary.

**Complexity**

| | |
|---|---|
| Time | \`O(n²)\` |
| Space | \`O(1)\` extra |

# Optimal Solution

Maintain a hash map from *value → index* for numbers already processed.

For each index \`i\` with value \`x\`:

1. Let \`need = target - x\`.
2. If \`need\` is already in the map, return \`[map[need], i]\`.
3. Otherwise store \`x → i\` and continue.

You never need to look ahead: the complementary partner of the current number, if it exists, must appear either earlier (already in the map) or later (when that later number looks backward).

> Tip: Prefer the *first* occurrence you stored when duplicates exist; the problem guarantees a unique answer pair.

# Correctness

Suppose the unique answer pair is \`(a, b)\` with \`a < b\` and \`nums[a] + nums[b] = target\`.

- When index \`a\` is processed, \`nums[b]\` is not yet in the map, so we store \`nums[a]\`.
- When index \`b\` is processed, \`need = target - nums[b] = nums[a]\` is present, so we return \`(a, b)\`.

No other pair sums to the target, so the algorithm cannot return a wrong pair.

# Complexity Analysis

| | |
|---|---|
| **Time** | \`O(n)\` — one pass; each hash map operation is expected \`O(1)\` |
| **Space** | \`O(n)\` — the map may store every element in the worst case |

# Common Mistakes

- Returning the values instead of the **indices**.
- Using the same index twice (\`i === j\`).
- Inserting into the map *before* checking for \`need\`, which can incorrectly pair an element with itself when \`2 * x === target\`.
- Assuming the array is sorted (it is not).

# Key Takeaways

- Complement lookups turn an \`O(n²)\` pair search into an \`O(n)\` scan.
- Hash maps trade memory for speed when you need “have I seen X?”.
- Always clarify whether the answer is values or indices.
`;

const A_PLUS_B_MARKDOWN = `# Intuition

The problem asks for the sum of two integers. It looks trivial, but a careful solution still respects input format, overflow considerations for fixed-width types, and clean I/O.

Think of it as a warm-up for reading input correctly and emitting exactly what the judge expects — nothing more, nothing less.

# Brute Force

There is no combinatorial search here. The “naive” approach *is* the natural approach: read \`a\` and \`b\`, compute \`a + b\`, print the result.

Any extra looping or sorting would only obscure the intent.

**Complexity**

| | |
|---|---|
| Time | \`O(1)\` |
| Space | \`O(1)\` |

# Optimal Solution

1. Read two integers from standard input (or the problem’s stated format).
2. Add them using ordinary integer arithmetic.
3. Write the sum followed by a newline if required.

In languages with fixed-width integers (for example 32-bit \`int\` in C++), confirm that the sum fits the type guaranteed by the constraints. If constraints allow values near the edges of a 32-bit range, prefer a wider type (such as \`long long\`) for the sum.

In Python, integers are arbitrary-precision, so overflow is not a concern.

# Correctness

Addition of integers is associative and closed over the integers. Given constraints that fit the chosen numeric type, \`a + b\` is exactly the mathematical sum. Emitting that value as decimal text matches the judge’s expected output for each test case.

# Complexity Analysis

| | |
|---|---|
| **Time** | \`O(1)\` — constant work per test case |
| **Space** | \`O(1)\` — a handful of scalar variables |

# Common Mistakes

- Printing prompts or debug text (e.g. \`"Enter a and b:"\`) — judges usually expect **only** the answer.
- Extra spaces or missing newlines that fail strict comparison.
- Using a type that overflows when \`a\` and \`b\` are both large.
- Reading input incorrectly (wrong order, or assuming a single line when multiple lines are used).

# Key Takeaways

- Simple problems still reward precise I/O discipline.
- Match types to constraints before you touch algorithms.
- When the judge is silent about formatting, prefer the minimal correct output.
`;

const PALINDROME_MARKDOWN = `# Intuition

A number is a palindrome when its decimal representation reads the same forward and backward (for example \`121\`). Negative numbers are typically not palindromes because of the leading minus sign.

You can reverse the digits and compare, or reverse only half the digits and stop early — both ideas rest on the same observation: symmetry around the middle of the digit sequence.

# Brute Force

Convert the number to a string (or build a digit list), then check that index \`i\` matches index \`n - 1 - i\` for every \`i\`.

Alternatively, reverse all digits into a new integer and compare with the original (watch out for overflow in fixed-width languages).

**Complexity**

| | |
|---|---|
| Time | \`O(d)\` where \`d\` is the number of digits (\`O(log₁₀ n)\`) |
| Space | \`O(d)\` for a string, or \`O(1)\` for a full integer reverse (plus overflow risk) |

# Optimal Solution

A clean approach reverses **only half** of the digits:

1. Reject negatives immediately.
2. Handle \`0\` as a palindrome; reject numbers that end in \`0\` but are not zero (they cannot be palindromes).
3. Repeatedly move the last digit of \`x\` onto a \`reverted\` integer while \`x > reverted\`.
4. At the end, either \`x === reverted\` (even length) or \`x === reverted / 10\` (odd length, middle digit ignored).

You never allocate a string, and you avoid reversing past the midpoint.

# Correctness

- Negatives fail by definition under the usual OJ convention.
- Numbers ending with \`0\` (except \`0\` itself) would need a leading zero after reversal, which decimal representation does not keep — so they are not palindromes.
- When the loop stops, \`reverted\` holds the reverse of the trailing half. Equality (or equality after dropping the middle digit) is exactly the palindrome condition.

# Complexity Analysis

| | |
|---|---|
| **Time** | \`O(d) = O(log n)\` — proportional to the number of digits |
| **Space** | \`O(1)\` — a few integers |

# Common Mistakes

- Forgetting that **negative** numbers are not palindromes.
- Accepting numbers like \`10\` or \`100\` (trailing zeros).
- Integer overflow when reversing the *entire* number in 32-bit arithmetic.
- Off-by-one mistakes when comparing halves of odd-length numbers.

# Key Takeaways

- Digit problems often reduce to careful half-reversals rather than strings.
- Edge cases (\`0\`, negatives, trailing zeros) dominate correctness.
- Prefer \`O(1)\` space when constraints allow in-place digit math.
`;

/** @type {Array<{ problemSlug: string, title: string, difficulty: 'easy'|'medium'|'hard', markdown: string }>} */
const DEMO_EDITORIALS = [
  {
    problemSlug: 'two-sum',
    title: 'Two Sum — Editorial',
    difficulty: 'easy',
    markdown: TWO_SUM_MARKDOWN,
  },
  {
    problemSlug: 'a-plus-b',
    title: 'A + B — Editorial',
    difficulty: 'easy',
    markdown: A_PLUS_B_MARKDOWN,
  },
  {
    problemSlug: 'palindrome-number',
    title: 'Palindrome Number — Editorial',
    difficulty: 'easy',
    markdown: PALINDROME_MARKDOWN,
  },
];

module.exports = { DEMO_EDITORIALS };
