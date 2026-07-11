// Auth business logic: registration, login, email verification, password recovery.
// No Express req/res, no JWT issuance (controller), no HTTP status construction.

const bcrypt = require('bcrypt');

const { config } = require('../../config');
const { withTransaction } = require('../../infrastructure/database/transaction');
const {
  sendEmail,
  buildVerifyEmailMessage,
  buildPasswordResetMessage,
} = require('../../infrastructure/email/email.service');
const { AppError } = require('../../shared/errors/base.error');
const { ConflictError, NotFoundError, ValidationError } = require('../../shared/errors/http-errors');
const { logger } = require('../../shared/logger/logger');
const { userRepository } = require('./auth.repository');
const {
  authTokenRepository,
  PURPOSE,
} = require('./auth-token.repository');
const { toPublicUser } = require('./auth.helpers');

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

const GENERIC_VERIFY_RESEND =
  'If an account exists for that email and is unverified, a verification link has been sent.';
const GENERIC_FORGOT =
  'If an account exists for that email, a password reset link has been sent.';

let dummyHashPromise;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('unused-placeholder-password', config.security.bcryptSaltRounds);
  }
  return dummyHashPromise;
}

function frontendUrl(path, query) {
  const base = config.email.appPublicUrl.replace(/\/$/, '');
  const url = new URL(path, `${base}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

class AuthService {
  constructor({
    userRepository: repo,
    authTokenRepository: tokenRepo,
  } = {}) {
    this.userRepository = repo || userRepository;
    this.authTokenRepository = tokenRepo || authTokenRepository;
  }

  async register({ username, email, password }) {
    const passwordHash = await bcrypt.hash(password, config.security.bcryptSaltRounds);

    const user = await withTransaction(async (client) => {
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
        return await this.userRepository.createUser(
          { username, email, passwordHash },
          client,
        );
      } catch (err) {
        if (err instanceof ConflictError) {
          throw AuthService.#mapUniqueConflict(err);
        }
        throw err;
      }
    });

    // Best-effort verification email — account remains usable.
    try {
      await this.#issueAndSendVerification(user);
    } catch (err) {
      logger.warn('Failed to send verification email after register', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return toPublicUser(user);
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
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

    return toPublicUser({
      ...user,
      last_login_at: new Date().toISOString(),
    });
  }

  /**
   * Confirm email via single-use token (24h).
   * @param {string} rawToken
   */
  async verifyEmail(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new ValidationError('A verification token is required.', [
        { field: 'token', issue: 'required' },
      ]);
    }

    return withTransaction(async (client) => {
      const tokenRow = await this.authTokenRepository.findValidByRawToken(
        rawToken,
        PURPOSE.EMAIL_VERIFICATION,
        client,
      );
      if (!tokenRow) {
        throw new AppError('This verification link is invalid or has expired.', {
          statusCode: 400,
          code: 'INVALID_VERIFICATION_TOKEN',
        });
      }

      const marked = await this.authTokenRepository.markUsed(tokenRow.id, client);
      if (!marked) {
        throw new AppError('This verification link is invalid or has expired.', {
          statusCode: 400,
          code: 'INVALID_VERIFICATION_TOKEN',
        });
      }

      const user = await this.userRepository.markEmailVerified(tokenRow.user_id, client);
      if (!user) {
        throw new NotFoundError('User not found.');
      }

      await this.authTokenRepository.invalidateUnusedForUser(
        tokenRow.user_id,
        PURPOSE.EMAIL_VERIFICATION,
        client,
      );

      return {
        user: toPublicUser(user),
        message: 'Email verified successfully.',
      };
    });
  }

  /**
   * Resend verification email. Always returns the same message (no enumeration).
   * @param {{ email?: string, userId?: string }} input
   */
  async resendVerification({ email, userId } = {}) {
    let user = null;
    if (userId) {
      user = await this.userRepository.findById(userId);
    } else if (email) {
      user = await this.userRepository.findByEmail(email);
    }

    if (user && !user.email_verified_at && !user.is_suspended) {
      try {
        await this.#issueAndSendVerification(user);
      } catch (err) {
        logger.warn('Failed to resend verification email', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (!user && email) {
      // Timing equalization when no account.
      await getDummyHash();
    }

    return { message: GENERIC_VERIFY_RESEND };
  }

  /**
   * Always generic response (no user enumeration).
   * @param {{ email: string }} input
   */
  async forgotPassword({ email }) {
    const user = await this.userRepository.findByEmail(email);

    if (user && !user.is_suspended) {
      try {
        await withTransaction(async (client) => {
          await this.authTokenRepository.invalidateUnusedForUser(
            user.id,
            PURPOSE.PASSWORD_RESET,
            client,
          );
          const expiresAt = new Date(Date.now() + RESET_TTL_MS);
          const issued = await this.authTokenRepository.createToken(
            {
              userId: user.id,
              purpose: PURPOSE.PASSWORD_RESET,
              expiresAt,
            },
            client,
          );
          const resetUrl = frontendUrl('/reset-password', { token: issued.rawToken });
          await sendEmail(
            buildPasswordResetMessage({
              to: user.email,
              username: user.username,
              resetUrl,
            }),
          );
        });
      } catch (err) {
        logger.warn('Failed to send password reset email', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      await getDummyHash();
    }

    return { message: GENERIC_FORGOT };
  }

  /**
   * Reset password with single-use token; bumps token_version (revokes JWTs).
   * @param {{ token: string, newPassword: string }} input
   */
  async resetPassword({ token, newPassword }) {
    const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptSaltRounds);

    return withTransaction(async (client) => {
      const tokenRow = await this.authTokenRepository.findValidByRawToken(
        token,
        PURPOSE.PASSWORD_RESET,
        client,
      );
      if (!tokenRow) {
        throw new AppError('This reset link is invalid or has expired.', {
          statusCode: 400,
          code: 'INVALID_RESET_TOKEN',
        });
      }

      const marked = await this.authTokenRepository.markUsed(tokenRow.id, client);
      if (!marked) {
        throw new AppError('This reset link is invalid or has expired.', {
          statusCode: 400,
          code: 'INVALID_RESET_TOKEN',
        });
      }

      const user = await this.userRepository.updatePasswordHash(
        tokenRow.user_id,
        passwordHash,
        client,
      );
      if (!user) {
        throw new NotFoundError('User not found.');
      }

      await this.authTokenRepository.invalidateUnusedForUser(
        tokenRow.user_id,
        PURPOSE.PASSWORD_RESET,
        client,
      );

      return {
        message: 'Password has been reset. Please sign in with your new password.',
      };
    });
  }

  /**
   * Change password while authenticated (requires current password).
   * Bumps token_version so existing JWTs stop working.
   * @param {{ userId: string, currentPassword: string, newPassword: string }} input
   */
  async changePassword({ userId, currentPassword, newPassword }) {
    const full = await this.userRepository.findByIdWithPassword(userId);
    if (!full) {
      throw new AppError('User account no longer exists.', {
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      });
    }

    const matches = await bcrypt.compare(currentPassword, full.password_hash);
    if (!matches) {
      throw new AppError('Current password is incorrect.', {
        statusCode: 400,
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptSaltRounds);
    const updated = await this.userRepository.updatePasswordHash(userId, passwordHash);
    return {
      user: toPublicUser(updated),
      message: 'Password updated. Please sign in again on other devices.',
    };
  }

  async #issueAndSendVerification(user) {
    await withTransaction(async (client) => {
      await this.authTokenRepository.invalidateUnusedForUser(
        user.id,
        PURPOSE.EMAIL_VERIFICATION,
        client,
      );
      const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);
      const issued = await this.authTokenRepository.createToken(
        {
          userId: user.id,
          purpose: PURPOSE.EMAIL_VERIFICATION,
          expiresAt,
        },
        client,
      );
      const verifyUrl = frontendUrl('/verify-email', { token: issued.rawToken });
      await sendEmail(
        buildVerifyEmailMessage({
          to: user.email,
          username: user.username,
          verifyUrl,
        }),
      );
    });
  }

  static #invalidCredentials() {
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

module.exports = {
  AuthService,
  authService: new AuthService(),
  toPublicUser,
  GENERIC_VERIFY_RESEND,
  GENERIC_FORGOT,
};
