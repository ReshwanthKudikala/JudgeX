/**
 * Coach SSE parser. Does not call Ollama.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '../../../..');

function loadFrontend(relativePath) {
  return import(pathToFileURL(path.join(repoRoot, relativePath)).href);
}

describe('coach SSE parser', () => {
  it('keeps a partial block until the next chunk and marks completion separately', async () => {
    const { consumeCoachSse } = await loadFrontend(
      'frontend/src/features/ai-assistant/coach-sse.js',
    );
    const events = [];
    const onEvent = (event, data) => events.push({ event, data });
    const rest = consumeCoachSse(
      'event: token\ndata: {"text":"Hel"}\n\nevent: token\ndata: {"text":',
      onEvent,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].data.text, 'Hel');
    consumeCoachSse(
      `${rest}"lo"}\n\nevent: done\ndata: {"answer":"Hello","incomplete":false}\n\n`,
      onEvent,
    );
    assert.equal(events[1].event, 'token');
    assert.equal(events[2].event, 'done');
    assert.equal(events[2].data.incomplete, false);
    assert.equal(events[2].data.answer, 'Hello');
  });

  it('turns a broken data line into an error event', async () => {
    const { consumeCoachSse } = await loadFrontend(
      'frontend/src/features/ai-assistant/coach-sse.js',
    );
    const events = [];
    consumeCoachSse('event: token\ndata: {not-json}\n\n', (event, data) => {
      events.push({ event, data });
    });
    assert.equal(events[0].event, 'error');
    assert.match(events[0].data.message, /malformed/i);
  });
});
