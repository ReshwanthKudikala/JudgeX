// Docker labels that identify a JudgeX sandbox belonging to one installation.
// The janitor removes only containers that carry both the sandbox label and
// this process's owner. Containers without them are never selected.

const SANDBOX_LABEL = 'judgex.sandbox';
const SANDBOX_OWNER_LABEL = 'judgex.sandbox.owner';
const SANDBOX_STARTED_LABEL = 'judgex.sandbox.startedAt';

module.exports = {
  SANDBOX_LABEL,
  SANDBOX_OWNER_LABEL,
  SANDBOX_STARTED_LABEL,
};
