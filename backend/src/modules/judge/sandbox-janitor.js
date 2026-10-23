// Removes exited JudgeX sandbox containers left behind by a finished job.
//
// A container is eligible only when it has judgex.sandbox=true AND
// judgex.sandbox.owner equal to an explicitly configured installation owner.
// Running containers are never removed: age is not proof that a job is
// finished, and this process cannot see another worker's in-flight sandbox.
// Missing labels, other owners, and unknown states are skipped. The default
// sweep does not contact Docker unless JUDGE_SANDBOX_OWNER is set.
//
// This module does not connect to Docker until sweepOrphanSandboxes() is called.

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { getDocker } = require('../../infrastructure/docker/docker.adapter');
const {
  SANDBOX_LABEL,
  SANDBOX_OWNER_LABEL,
  SANDBOX_STARTED_LABEL,
} = require('./sandbox-labels');

const DEFAULT_GRACE_MS = 5_000;

/**
 * @param {object} info - Docker listContainers entry
 * @param {{
 *   owner: string,
 *   now: number,
 *   staleAfterMs: number,
 *   graceMs?: number,
 *   activeIds?: Set<string>,
 * }} opts
 * @returns {'stale'|'active'|'skip'}
 */
function classifySandboxContainer(info, opts) {
  const labels = (info && info.Labels) || {};
  if (labels[SANDBOX_LABEL] !== 'true') return 'skip';
  if (!opts.owner || labels[SANDBOX_OWNER_LABEL] !== opts.owner) return 'skip';

  const state = info.State || '';
  // A live container might still belong to a job older than the BullMQ lock.
  // There is no cross-process heartbeat, so running containers fail closed.
  if (state === 'running') return 'active';

  const started = Number(labels[SANDBOX_STARTED_LABEL]);
  const age = Number.isFinite(started) ? opts.now - started : Number.POSITIVE_INFINITY;
  const graceMs = opts.graceMs ?? DEFAULT_GRACE_MS;

  if (state === 'created' || state === 'exited' || state === 'dead') {
    return age < graceMs ? 'active' : 'stale';
  }
  return 'skip';
}

/**
 * @param {{
 *   docker?: { listContainers: Function, getContainer: Function },
 *   owner?: string,
 *   now?: number,
 *   staleAfterMs?: number,
 *   graceMs?: number,
 *   activeIds?: Set<string>,
 * }} [opts]
 */
function emptySweep(skippedReason) {
  return { scanned: 0, removed: 0, active: 0, skipped: 0, failed: 0, skippedReason };
}

async function sweepOrphanSandboxes(opts = {}) {
  const ownerExplicit = opts.ownerExplicit ?? (opts.owner ? true : config.judge.sandboxOwnerExplicit);
  if (!ownerExplicit) {
    return emptySweep('owner_not_configured');
  }

  const docker = opts.docker || getDocker();
  const owner = opts.owner || config.judge.sandboxOwner;
  if (!owner) {
    return emptySweep('owner_not_configured');
  }
  const now = opts.now ?? Date.now();
  const summary = { scanned: 0, removed: 0, active: 0, skipped: 0, failed: 0 };

  const listed = await docker.listContainers({
    all: true,
    filters: {
      label: [`${SANDBOX_LABEL}=true`, `${SANDBOX_OWNER_LABEL}=${owner}`],
    },
  });
  const containers = Array.isArray(listed) ? listed : [];
  summary.scanned = containers.length;

  for (const info of containers) {
    const decision = classifySandboxContainer(info, {
      owner,
      now,
      graceMs: opts.graceMs,
    });
    if (decision === 'active') {
      summary.active += 1;
      continue;
    }
    if (decision !== 'stale') {
      summary.skipped += 1;
      continue;
    }

    const id = info.Id || info.id;
    try {
      await docker.getContainer(id).remove({ force: true });
      summary.removed += 1;
    } catch (err) {
      summary.failed += 1;
      logger.warn('Sandbox janitor could not remove container', {
        containerId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}

/**
 * Periodic sweep. Does not run until the timer fires.
 * @param {{ intervalMs?: number, sweep?: () => Promise<unknown> }} [opts]
 */
function startSandboxJanitor(opts = {}) {
  const intervalMs = opts.intervalMs ?? config.reaper.intervalMs;
  const sweep = opts.sweep || (() => sweepOrphanSandboxes());
  const timer = setInterval(() => {
    sweep().catch((err) => {
      logger.warn('Sandbox janitor sweep failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop() {
      clearInterval(timer);
    },
  };
}

module.exports = {
  classifySandboxContainer,
  sweepOrphanSandboxes,
  startSandboxJanitor,
  DEFAULT_GRACE_MS,
};
