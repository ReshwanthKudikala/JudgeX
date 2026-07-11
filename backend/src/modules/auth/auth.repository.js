// Data access for the users table (auth module owns the users aggregate).
//
// Pure data access only: parameterized SQL via BaseRepository helpers, optional
// transaction client on every method. No business logic, validation, password
// hashing, DTO mapping, or HTTP knowledge (see infrastructure/database/README.md).
// Rows are returned exactly as the database provides them (RETURNING */SELECT *).

const { BaseRepository } = require('../../infrastructure/database/base.repository');

// Non-sensitive user fields safe to return to callers (never password_hash).
const PUBLIC_COLUMNS =
  'id, username, email, role, is_suspended, last_login_at, email_verified_at, token_version, created_at, updated_at';

class UserRepository extends BaseRepository {
  /**
   * Insert a new user row and return it.
   * The caller supplies an already-hashed password; hashing is not done here.
   *
   * @param {{ username: string, email: string, passwordHash: string, role?: string }} data
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object>} the inserted users row.
   */
  createUser({ username, email, passwordHash, role }, client) {
    const id = this.newId();

    if (role !== undefined) {
      return this.queryOne(
        `INSERT INTO users (id, username, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${PUBLIC_COLUMNS}`,
        [id, username, email, passwordHash, role],
        client,
      );
    }

    return this.queryOne(
      `INSERT INTO users (id, username, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_COLUMNS}`,
      [id, username, email, passwordHash],
      client,
    );
  }

  findByEmail(email, client) {
    return this.queryOne(
      `SELECT id, username, email, password_hash, role, is_suspended, last_login_at,
              email_verified_at, token_version, created_at, updated_at
         FROM users
        WHERE email = $1
          AND is_deleted = false`,
      [email],
      client,
    );
  }

  findById(id, client) {
    return this.queryOne(
      `SELECT ${PUBLIC_COLUMNS}
         FROM users
        WHERE id = $1
          AND is_deleted = false`,
      [id],
      client,
    );
  }

  /** Like findById but includes password_hash for credential checks. */
  findByIdWithPassword(id, client) {
    return this.queryOne(
      `SELECT id, username, email, password_hash, role, is_suspended, last_login_at,
              email_verified_at, token_version, created_at, updated_at
         FROM users
        WHERE id = $1
          AND is_deleted = false`,
      [id],
      client,
    );
  }

  findByUsername(username, client) {
    return this.queryOne(
      `SELECT ${PUBLIC_COLUMNS}
         FROM users
        WHERE username = $1
          AND is_deleted = false`,
      [username],
      client,
    );
  }

  touchLastLogin(id, client) {
    return this.query(
      `UPDATE users SET last_login_at = now(), updated_at = now()
        WHERE id = $1 AND is_deleted = false`,
      [id],
      client,
    );
  }

  markEmailVerified(id, client) {
    return this.queryOne(
      `UPDATE users
          SET email_verified_at = COALESCE(email_verified_at, now()),
              updated_at = now()
        WHERE id = $1
          AND is_deleted = false
        RETURNING ${PUBLIC_COLUMNS}`,
      [id],
      client,
    );
  }

  updatePasswordHash(id, passwordHash, client) {
    return this.queryOne(
      `UPDATE users
          SET password_hash = $2,
              token_version = token_version + 1,
              updated_at = now()
        WHERE id = $1
          AND is_deleted = false
        RETURNING ${PUBLIC_COLUMNS}`,
      [id, passwordHash],
      client,
    );
  }

  bumpTokenVersion(id, client) {
    return this.queryOne(
      `UPDATE users
          SET token_version = token_version + 1,
              updated_at = now()
        WHERE id = $1
          AND is_deleted = false
        RETURNING ${PUBLIC_COLUMNS}`,
      [id],
      client,
    );
  }
}

module.exports = { UserRepository, userRepository: new UserRepository(), PUBLIC_COLUMNS };
