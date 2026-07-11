// Cryptographically secure auth tokens (email verify / password reset).
// Raw tokens are returned once to callers; only SHA-256 hashes are stored.

const crypto = require('crypto');

const { BaseRepository } = require('../../infrastructure/database/base.repository');

const PURPOSE = Object.freeze({
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
});

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken), 'utf8').digest('hex');
}

function generateRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

class AuthTokenRepository extends BaseRepository {
  /**
   * @param {{ userId: string, purpose: string, expiresAt: Date, rawToken?: string }} input
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<{ id: string, rawToken: string, expiresAt: Date }>}
   */
  async createToken({ userId, purpose, expiresAt, rawToken }, client) {
    const id = this.newId();
    const raw = rawToken || generateRawToken();
    const tokenHash = hashToken(raw);
    await this.query(
      `INSERT INTO auth_tokens (id, user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, tokenHash, purpose, expiresAt],
      client,
    );
    return { id, rawToken: raw, expiresAt };
  }

  /**
   * Invalidate unused tokens of a purpose for a user (e.g. before issuing a new one).
   */
  async invalidateUnusedForUser(userId, purpose, client) {
    return this.query(
      `UPDATE auth_tokens
          SET used_at = COALESCE(used_at, now())
        WHERE user_id = $1
          AND purpose = $2
          AND used_at IS NULL`,
      [userId, purpose],
      client,
    );
  }

  /**
   * Load an unused, unexpired token by raw value + purpose.
   * @returns {Promise<object|null>}
   */
  findValidByRawToken(rawToken, purpose, client) {
    return this.queryOne(
      `SELECT id, user_id, purpose, expires_at, used_at, created_at
         FROM auth_tokens
        WHERE token_hash = $1
          AND purpose = $2
          AND used_at IS NULL
          AND expires_at > now()`,
      [hashToken(rawToken), purpose],
      client,
    );
  }

  markUsed(id, client) {
    return this.queryOne(
      `UPDATE auth_tokens
          SET used_at = now()
        WHERE id = $1
          AND used_at IS NULL
        RETURNING id`,
      [id],
      client,
    );
  }
}

module.exports = {
  AuthTokenRepository,
  authTokenRepository: new AuthTokenRepository(),
  PURPOSE,
  hashToken,
  generateRawToken,
};
