/**
 * Sprint 31 — admin platform helper mapping unit tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';

const { AdminPlatformService } = require('../../../src/modules/admin/admin.platform.service');

describe('AdminPlatformService overview mapping', () => {
  it('builds overview from repository counts and queue health', async () => {
    const svc = new AdminPlatformService({
      platformRepository: {
        getOverviewCounts: async () => ({
          total_users: 10,
          active_users_7d: 3,
          active_users_30d: 7,
          total_problems: 5,
          published_problems: 4,
          total_editorials: 2,
          published_editorials: 1,
          total_discussions: 8,
          total_contests: 1,
          total_submissions: 100,
          accepted_submissions: 40,
        }),
      },
      auditRepository: {
        insert: async () => ({}),
      },
    });

    // Bypass redis by stubbing cache via direct service call with mocked getOverviewCounts.
    // getOverview also hits BullMQ — wrap and assert core numbers if queue fails gracefully.
    const overview = await svc.getOverview();
    assert.equal(overview.users.total, 10);
    assert.equal(overview.problems.published, 4);
    assert.equal(overview.submissions.acceptanceRate, 40);
    assert.ok(overview.queue);
    assert.ok(overview.worker);
  });
});
