// Data access for the users table (auth module owns the users aggregate).
//
// Pure data access only: parameterized SQL via BaseRepository helpers, optional
// transaction client on every method. No business logic, validation, password
// hashing, DTO mapping, or HTTP knowledge (see infrastructure/database/README.md).
// Rows are returned exactly as the database provides them (RETURNING */SELECT *).

const { BaseRepository } = require('../../infrastructure/database/base.repository');

// Non-sensitive user fields safe to return to callers (never password_hash).
const PUBLIC_COLUMNS = 'id, username, email, role, created_at, updated_at';

class UserRepository extends BaseRepository {
  /**
   * Insert a new user row and return it.
   * The caller supplies an already-hashed password; hashing is not done here.
   *
   * @param {{ username: string, email: string, passwordHash: string, role?: string }} data
   * @param {import('pg').PoolClient} [client] - optional transaction client so
   *        this insert can join a caller's unit of work (e.g. user + stats row).
   * @returns {Promise<Object>} the inserted users row.
   */
  createUser({ username, email, passwordHash, role }, client) {
    const id = this.newId();

    // `role` is optional: when omitted, the column's DB default (`'user'`) applies.
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

  /**
   * Fetch a single active (non-soft-deleted) user by email.
   * `email` is CITEXT, so the match is case-insensitive at the DB level.
   *
   * @param {string} email
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the users row (incl. password_hash), or null.
   */
  findByEmail(email, client) {
    // Includes password_hash because this read backs credential verification.
    return this.queryOne(
      `SELECT id, username, email, password_hash, role, created_at, updated_at
         FROM users
        WHERE email = $1
          AND is_deleted = false`,
      [email],
      client,
    );
  }

  /**
   * Fetch a single active (non-soft-deleted) user by primary key.
   *
   * @param {string} id - UUID.
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the users row, or null if none.
   */
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

  /**
   * Fetch a single active (non-soft-deleted) user by username.
   * Backs the registration uniqueness check; returns public fields only.
   *
   * @param {string} username
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<Object|null>} the users row, or null if none.
   */
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
}

module.exports = { UserRepository, userRepository: new UserRepository() };
