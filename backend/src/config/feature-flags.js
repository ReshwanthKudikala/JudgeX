// Resolves optional/rolling feature flags from validated env (safe defaults).

function resolveFeatureFlags(env) {
  return Object.freeze({
    // MVP AI capability: compile-error explanation (provider-agnostic).
    aiCompileExplanation: env.FEATURE_AI_COMPILE_EXPLANATION,
    // Placeholders for post-MVP features (default off until shipped).
    aiAdvanced: false,
    contests: false,
  });
}

module.exports = { resolveFeatureFlags };
