// Auth business logic: registration and login (password hashing/comparison).
//
// Business logic only: no Express req/res, no JWT/cookies/refresh tokens, no
// HTTP status codes, no validation/DTO mapping. Persistence is delegated to
// UserRepository; multi-step atomicity uses the database transaction manager.

const bcrypt = require('bcrypt');

const { config } = require('../../config');
const { withTransaction } = require('../../infrastructure/database/transaction');
const { AppError } = require('../../shared/errors/base.error');
const { ConflictError } = require('../../shared/errors/http-errors');
const { userRepository } = require('./auth.repository');

// A fixed hash compared against when no user matches, so login timing does not
// reveal whether an email exists (no user enumeration — PRD/API_SPEC).
let dummyHashPromise;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('unused-placeholder-password', config.security.bcryptSaltRounds);
  }
  return dummyHashPromise;
}

class AuthService {
  constructor({ userRepository: repo } = {}) {
    this.userRepository = repo || userRepository;
  }

  /**
   * Register a new account: ensure email/username are free, hash the password,
   * and persist the user. Runs inside a transaction so the uniqueness checks and
   * the insert form one unit of work (and future user_statistics init joins it).
   *
   * @param {{ username: string, email: string, password: string }} input
   * @returns {Promise<Object>} the created user (without password_hash).
   */
  async register({ username, email, password }) {
    // Hash outside the transaction — CPU-bound work shouldn't hold a DB client.
    const passwordHash = await bcrypt.hash(password, config.security.bcryptSaltRounds);

    return withTransaction(async (client) => {
      // Friendly pre-checks; the DB unique constraints remain the real guarantee.
      if (await this.userRepository.findByEmail(email, client)) {
        throw new AppError('An account with this email already exists.', {
          statusCode: 409,
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }
      if (await this.userRepository.findByUsername(username, client)) {
        throw new AppError('This username is already taken.', {
          statusCode: 409,
          code: 'USERNAME_ALREADY_EXISTS',
        });
      }

      try {
        return await this.userRepository.createUser({ username, email, passwordHash }, client);
      } catch (err) {
        // Handle the race where a concurrent insert wins between check and insert:
        // translate the generic unique-violation conflict into a specific code.
        if (err instanceof ConflictError) {
          throw AuthService.#mapUniqueConflict(err);
        }
        throw err;
      }
    });
  }

  /**
   * Authenticate by email + password.
   *
   * @param {{ email: string, password: string }} input
   * @returns {Promise<Object>} the authenticated user (without password_hash).
   */
  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Equalize timing with the success path, then fail identically.
      await bcrypt.compare(password, await getDummyHash());
      throw AuthService.#invalidCredentials();
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw AuthService.#invalidCredentials();
    }

    if (user.is_suspended === true) {
      throw new AppError('This account has been suspended.', {
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    await this.userRepository.touchLastLogin(user.id);

    // Never return the hash to callers.
    const { password_hash: _passwordHash, ...safeUser } = user;
    return {
      ...safeUser,
      last_login_at: new Date().toISOString(),
    };
  }

  static #invalidCredentials() {
    // Same error for "no such user" and "wrong password" (no enumeration).
    return new AppError('Invalid email or password.', {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  static #mapUniqueConflict(err) {
    const constraint = err.details && err.details.constraint;
    if (constraint === 'uq_users_email') {
      return new AppError('An account with this email already exists.', {
        statusCode: 409,
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }
    if (constraint === 'uq_users_username') {
      return new AppError('This username is already taken.', {
        statusCode: 409,
        code: 'USERNAME_ALREADY_EXISTS',
      });
    }
    return err;
  }
}

module.exports = { AuthService, authService: new AuthService() };
