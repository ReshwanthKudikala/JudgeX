// Build / release metadata (injected via env at image build or CI).
// Safe to expose publicly — no secrets.

const pkg = require('../../package.json');

/**
 * @returns {{
 *   version: string,
 *   gitSha: string,
 *   buildTime: string | null,
 *   node: string,
 * }}
 */
function getBuildInfo() {
  const gitSha =
    process.env.GIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    'unknown';

  return {
    version: process.env.APP_VERSION || pkg.version,
    gitSha: String(gitSha).slice(0, 40),
    buildTime: process.env.BUILD_TIME || null,
    node: process.version,
  };
}

module.exports = { getBuildInfo };
