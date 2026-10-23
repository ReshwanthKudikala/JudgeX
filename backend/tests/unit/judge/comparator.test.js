/**
 * Direct tests for the judge output comparator.
 * These call compareOutputs, not the trim substitute used by the pipeline unit tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { compareOutputs } = require('../../../src/modules/judge/comparator');

describe('compareOutputs', () => {
  it('treats CRLF, lone CR, and LF as the same line breaks', () => {
    const crlf = compareOutputs('1\r\n2\r\n', '1\n2\n');
    assert.equal(crlf.matches, true);
    assert.equal(crlf.actual, '1\n2');
    assert.equal(crlf.expected, '1\n2');

    const loneCr = compareOutputs('1\r2\r', '1\n2');
    assert.equal(loneCr.matches, true);
    assert.equal(loneCr.actual, '1\n2');
  });

  it('strips trailing spaces and tabs on each line and keeps leading whitespace', () => {
    const trailing = compareOutputs('3 \n4\t\n', '3\n4\n');
    assert.equal(trailing.matches, true);
    assert.equal(trailing.actual, '3\n4');

    const leading = compareOutputs(' 3\n', '3\n');
    assert.equal(leading.matches, false);
    assert.equal(leading.actual, ' 3');
    assert.equal(leading.expected, '3');
  });

  it('drops blank lines only at the end of the output', () => {
    const trailingBlanks = compareOutputs('3\n\n\n', '3');
    assert.equal(trailingBlanks.matches, true);
    assert.equal(trailingBlanks.actual, '3');

    const spacesThenBlank = compareOutputs('3\n  \n\t\n', '3\n');
    assert.equal(spacesThenBlank.matches, true);
    assert.equal(spacesThenBlank.actual, '3');
  });

  it('keeps a meaningful internal blank line', () => {
    const kept = compareOutputs('a\n\nb\n', 'a\nb\n');
    assert.equal(kept.matches, false);
    assert.equal(kept.actual, 'a\n\nb');
    assert.equal(kept.expected, 'a\nb');

    const sameGap = compareOutputs('a\r\n\r\nb', 'a\n\nb\n\n');
    assert.equal(sameGap.matches, true);
    assert.equal(sameGap.actual, 'a\n\nb');

    const spacesBecomeAGap = compareOutputs('a\n   \nb', 'a\n\nb');
    assert.equal(spacesBecomeAGap.matches, true);
    assert.equal(spacesBecomeAGap.actual, 'a\n\nb');
  });

  it('rejects a one-character mismatch', () => {
    const result = compareOutputs('hello\n', 'hellp\n');
    assert.equal(result.matches, false);
    assert.equal(result.actual, 'hello');
    assert.equal(result.expected, 'hellp');
  });

  it('treats null, undefined, and empty output as equal and keeps a real zero', () => {
    const empty = compareOutputs(null, undefined);
    assert.equal(empty.matches, true);
    assert.equal(empty.actual, '');
    assert.equal(empty.expected, '');

    const blank = compareOutputs('', ' \n\n');
    assert.equal(blank.matches, true);
    assert.equal(blank.actual, '');

    const zero = compareOutputs('0\n', '');
    assert.equal(zero.matches, false);
    assert.equal(zero.actual, '0');
    assert.equal(zero.expected, '');

    const buffer = compareOutputs(Buffer.from('a\r\nb\r\n'), 'a\nb');
    assert.equal(buffer.matches, true);
    assert.equal(buffer.actual, 'a\nb');
  });
});
