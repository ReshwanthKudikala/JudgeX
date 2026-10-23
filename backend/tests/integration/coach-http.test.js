/**
 * Coach HTTP boundary. Requests go through the Express app, authenticate,
 * and CoachService. External generation and execution are counted, not bypassed.
 */

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, createUser } = require('./helpers/fixtures');
const { problemRepository } = require('../../src/modules/problems/problems.repository');
const { testCaseService } = require('../../src/modules/problems/testcase.service');
const { coachService } = require('../../src/modules/ai/coach.service');
const { getCoachProvider } = require('../../src/modules/ai/providers/provider.factory');
const { REFUSAL_MESSAGE } = require('../../src/modules/ai/coach-scope');
const queueService = require('../../src/infrastructure/queue/queue.service');

const { requireInfra } = registerSuiteHooks();

const PROBLEM_ID = '00000000-0000-4000-8000-0000000000c1';

function coachBody() {
  return {
    problemId: PROBLEM_ID,
    language: 'python',
    code: 'print(1)\n',
    action: 'EXPLAIN_CODE',
    message: 'Explain the weather today',
  };
}

function parseSse(text) {
  const events = [];
  for (const block of String(text).split('\n\n')) {
    if (!block.trim()) continue;
    let event = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
    }
    events.push({
      event,
      data: dataLines.length > 0 ? JSON.parse(dataLines.join('\n')) : null,
    });
  }
  return events;
}

function watchCoachBoundaries() {
  const calls = {
    findById: 0,
    getPublicExamples: 0,
    verify: 0,
    complete: 0,
    completeStream: 0,
    enqueue: 0,
  };
  const restorers = [];
  function spy(target, name, impl) {
    const mocked = mock.method(target, name, impl);
    restorers.push(() => mocked.mock.restore());
  }

  const originalFind = problemRepository.findById.bind(problemRepository);
  const originalExamples = testCaseService.getPublicExamples.bind(testCaseService);
  const provider = getCoachProvider();

  spy(problemRepository, 'findById', async (...args) => {
    calls.findById += 1;
    return originalFind(...args);
  });
  spy(testCaseService, 'getPublicExamples', async (...args) => {
    calls.getPublicExamples += 1;
    return originalExamples(...args);
  });
  spy(coachService, 'verifyExecution', async () => {
    calls.verify += 1;
    throw new Error('sandbox verification was called');
  });
  spy(provider, 'complete', async () => {
    calls.complete += 1;
    throw new Error('Ollama complete was called');
  });
  spy(provider, 'completeStream', async function* recordStream() {
    calls.completeStream += 1;
    throw new Error('Ollama streaming was called');
  });
  spy(queueService, 'enqueueRunAndWait', async () => {
    calls.enqueue += 1;
    throw new Error('run-code enqueue was called');
  });

  return {
    calls,
    restore() {
      while (restorers.length > 0) restorers.pop()();
    },
  };
}

function assertUntouched(calls) {
  assert.equal(calls.findById, 0);
  assert.equal(calls.getPublicExamples, 0);
  assert.equal(calls.verify, 0);
  assert.equal(calls.complete, 0);
  assert.equal(calls.completeStream, 0);
  assert.equal(calls.enqueue, 0);
}

describe('AI Coach HTTP boundary', () => {
  it('rejects an unauthenticated coach request', async (t) => {
    if (!requireInfra(t)) return;
    const watch = watchCoachBoundaries();
    t.after(() => watch.restore());

    const res = await api().post('/api/v1/ai/coach').send(coachBody());
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    assertUntouched(watch.calls);
  });

  it('rejects an unauthenticated coach stream', async (t) => {
    if (!requireInfra(t)) return;
    const watch = watchCoachBoundaries();
    t.after(() => watch.restore());

    const res = await api().post('/api/v1/ai/coach/stream').send(coachBody());
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    assertUntouched(watch.calls);
  });

  it('returns the policy refusal for an out-of-scope coach request', async (t) => {
    if (!requireInfra(t)) return;
    const watch = watchCoachBoundaries();
    t.after(() => watch.restore());
    const user = await createUser();

    const res = await api()
      .post('/api/v1/ai/coach')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(coachBody());

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.answer, REFUSAL_MESSAGE);
    assert.equal(res.body.data.provider, 'policy');
    assert.equal(res.body.data.model, 'scope');
    assert.equal(res.body.data.verification, 'skipped');
    assert.equal(res.body.data.tokensUsed, null);
    assert.equal(res.body.data.format, 'markdown');
    assert.doesNotMatch(res.body.data.answer, /Verified:/);
    assertUntouched(watch.calls);
  });

  it('streams the same policy refusal without starting generation', async (t) => {
    if (!requireInfra(t)) return;
    const watch = watchCoachBoundaries();
    t.after(() => watch.restore());
    const user = await createUser();

    const res = await api()
      .post('/api/v1/ai/coach/stream')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(coachBody());

    assert.equal(res.status, 200, res.text);
    assert.match(String(res.headers['content-type']), /text\/event-stream/);
    const events = parseSse(res.text);
    const token = events.find((event) => event.event === 'token');
    const done = events.find((event) => event.event === 'done');
    assert.ok(token);
    assert.equal(token.data.text, REFUSAL_MESSAGE);
    assert.ok(done);
    assert.equal(done.data.answer, REFUSAL_MESSAGE);
    assert.equal(done.data.provider, 'policy');
    assert.equal(done.data.model, 'scope');
    assert.equal(done.data.verification, 'skipped');
    assert.equal(done.data.incomplete, false);
    assert.equal(done.data.tokensUsed, null);
    assertUntouched(watch.calls);
  });
});
