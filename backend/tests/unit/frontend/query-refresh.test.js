/**
 * Frontend cache refresh after a terminal verdict, and the editorial probe skip.
 * The helpers live in the frontend package (ESM) and are imported directly.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '../../../..');

function loadFrontend(relativePath) {
  return import(pathToFileURL(path.join(repoRoot, relativePath)).href);
}

describe('terminal verdict query refresh', () => {
  it('refreshes problem statistics, problem detail, and user progress for the slug', async () => {
    const { queryKeysToRefreshAfterTerminalVerdict } = await loadFrontend(
      'frontend/src/features/submissions/terminal-refresh.js',
    );
    assert.deepEqual(queryKeysToRefreshAfterTerminalVerdict('a-plus-b'), [
      ['submissions'],
      ['problem-statistics', 'a-plus-b'],
      ['problem', 'a-plus-b'],
    ]);
  });

  it('still refreshes statistics and progress when the slug is missing', async () => {
    const { queryKeysToRefreshAfterTerminalVerdict } = await loadFrontend(
      'frontend/src/features/submissions/terminal-refresh.js',
    );
    assert.deepEqual(queryKeysToRefreshAfterTerminalVerdict(undefined), [
      ['submissions'],
      ['problem-statistics'],
      ['problem'],
    ]);
  });

  it('wires the refresh to a terminal polled submission on the problem page', () => {
    const hook = fs.readFileSync(
      path.join(repoRoot, 'frontend/src/features/submissions/hooks/useSubmission.ts'),
      'utf8',
    );
    const editor = fs.readFileSync(
      path.join(repoRoot, 'frontend/src/features/editor/components/ProblemCodeEditor.tsx'),
      'utf8',
    );
    assert.match(hook, /if \(!submission \|\| !isTerminalSubmission\(submission\)\) return;/);
    assert.match(hook, /queryKeysToRefreshAfterTerminalVerdict\(problemSlug\)/);
    assert.match(hook, /queryClient\.invalidateQueries\(\{ queryKey \}\)/);
    assert.match(editor, /useSubmission\(problemSlug\)/);
  });
});

describe('editorial request', () => {
  it('skips the editorial GET when the problem says none is published', async () => {
    const { editorialRequestSlug } = await loadFrontend(
      'frontend/src/features/editorials/editorial-request.js',
    );
    assert.equal(editorialRequestSlug({ slug: 'a-plus-b', hasEditorial: false }), null);
    assert.equal(editorialRequestSlug({ slug: 'a-plus-b', hasEditorial: true }), 'a-plus-b');
    assert.equal(editorialRequestSlug({ slug: 'a-plus-b' }), 'a-plus-b');
    assert.equal(editorialRequestSlug(undefined), null);
  });

  it('uses that decision on the problem page', () => {
    const page = fs.readFileSync(
      path.join(repoRoot, 'frontend/src/pages/ProblemDetailPage.tsx'),
      'utf8',
    );
    assert.match(page, /useEditorial\(editorialRequestSlug\(problem\) \?\? undefined\)/);
  });
});
