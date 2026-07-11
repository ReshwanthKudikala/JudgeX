// Resolves optional/rolling feature flags from validated env (safe defaults).

function resolveFeatureFlags(env) {
  return Object.freeze({
    // MVP AI capability: compile-error explanation (provider-agnostic).
    aiCompileExplanation: env.FEATURE_AI_COMPILE_EXPLANATION,
    // Sprint 29 — learning assistant (hints, complexity, verdict help).
    aiAdvanced: env.FEATURE_AI_ADVANCED,
    contests: true,
    editorials: true,
  });
}

module.exports = { resolveFeatureFlags };
