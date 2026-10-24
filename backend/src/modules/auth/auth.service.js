// Auth business logic: registration, login, email verification, password recovery.
// No Express req/res, no JWT issuance (controller), no HTTP status construction.

const bcrypt = require('bcrypt');

const { config } = require('../../config');
const { withTransaction } = require('../../infrastructure/database/transaction');
const {
  sendEmail,
  buildVerifyEmailMessage,
  buildPasswordResetMessage,
  redactMessageText,
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
const RESEND_COOLDOWN_MS = 60 * 1000;

function publicForgotResult() {
  const transportNote =
    config.email?.provider === 'smtp'
      ? 'When this server uses SMTP, an eligible message is submitted to the mail server. Submission does not guarantee inbox delivery.'
      : 'This server is in console mode. An eligible message is written to the local development mailbox and is not emailed.';
  return {
    message:
      'If an account exists for that email, a password reset message has been requested. ' +
      transportNote,
  };
}

let emailSender = sendEmail;

function setEmailSenderForTests(fn) {
  emailSender = typeof fn === 'function' ? fn : sendEmail;
}

function frontendUrl(path, query) {
  const base = String(config.email.frontendUrl || '').replace(/\/$/, '');
  let url;
  try {
    url = new URL(path, `${base}/`);
  } catch {
    throw new AppError('FRONTEND_URL is not a valid absolute URL.', {
      statusCode: 503,
      code: 'EMAIL_NOT_CONFIGURED',
    });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('FRONTEND_URL must use http or https.', {
      statusCode: 503,
      code: 'EMAIL_NOT_CONFIGURED',
    });
  }
  if (url.origin !== new URL(base).origin) {
    throw new AppError('Email links must stay on the configured frontend origin.', {
      statusCode: 503,
      code: 'EMAIL_NOT_CONFIGURED',
    });
  }
  url.search = '';
  if (query && Object.keys(query).length > 0) {
    const hash = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      hash.set(key, String(value));
    }
    url.hash = hash.toString();
  }
  return url.toString();
}

function publicResendResult() {
  const transportNote =
    config.email?.provider === 'smtp'
      ? 'When this server uses SMTP, an eligible message is submitted to the mail server. Submission does not guarantee inbox delivery.'
      : 'This server is in console mode. An eligible message is written to the local development mailbox and is not emailed.';
  return {
    outcome: 'accepted',
    delivery: null,
    message:
      'If an account exists for that email and still needs verification, a verification message has been requested. ' +
      transportNote,
  };
}

function deliveryResult(sent) {
  if (sent?.delivery === 'submitted') {
    return {
      outcome: 'submitted',
      delivery: 'smtp',
      message:
        'The verification message was submitted to the configured mail server. Submission does not guarantee inbox delivery.',
    };
  }
  return {
    outcome: 'logged',
    delivery: 'console',
    message:
      'The verification message was written to the local development mailbox. It was not emailed.',
  };
}

function logSendFailure(event, userId, err) {
  const raw = err instanceof Error ? err.message : String(err);
  logger.warn(event, {
    userId,
    code: err && err.code ? err.code : undefined,
    error: redactMessageText(raw),
  });
}

let dummyHashPromise;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('unused-placeholder-password', config.security.bcryptSaltRounds);
  }
  return dummyHashPromise;
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

    // Best-effort verification message — the account remains usable if sending fails.
    let verification;
    try {
      verification = deliveryResult(await this.#issueAndSendVerification(user));
    } catch (err) {
      logSendFailure('verification_send_failed', user.id, err);
      verification = {
        outcome: 'failed',
        delivery: null,
        message:
          'The account was created, but the verification message could not be sent. Sign in and use Resend on your profile.',
      };
    }

    return { user: toPublicUser(user), verification };
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
      const tokenRow = await this.authTokenRepository.findByRawTokenForUpdate(
        rawToken,
        PURPOSE.EMAIL_VERIFICATION,
        client,
      );
      if (!tokenRow) {
        throw new AppError('This verification link is invalid.', {
          statusCode: 400,
          code: 'INVALID_VERIFICATION_TOKEN',
        });
      }

      const existing = await this.userRepository.findById(tokenRow.user_id, client);
      if (!existing) {
        throw new AppError('This verification link is invalid.', {
          statusCode: 400,
          code: 'INVALID_VERIFICATION_TOKEN',
        });
      }

      if (existing.email_verified_at) {
        if (!tokenRow.used_at) {
          await this.authTokenRepository.markUsed(tokenRow.id, client);
          await this.authTokenRepository.invalidateUnusedForUser(
            tokenRow.user_id,
            PURPOSE.EMAIL_VERIFICATION,
            client,
          );
        }
        return {
          user: toPublicUser(existing),
          alreadyVerified: true,
          message: 'This email address is already verified.',
        };
      }

      if (tokenRow.used_at) {
        throw new AppError('This verification link was already used.', {
          statusCode: 400,
          code: 'USED_VERIFICATION_TOKEN',
        });
      }
      if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
        throw new AppError('This verification link has expired. Request a new one.', {
          statusCode: 400,
          code: 'EXPIRED_VERIFICATION_TOKEN',
        });
      }

      const marked = await this.authTokenRepository.markUsed(tokenRow.id, client);
      if (!marked) {
        throw new AppError('This verification link was already used.', {
          statusCode: 400,
          code: 'USED_VERIFICATION_TOKEN',
        });
      }

      const user = await this.userRepository.markEmailVerified(tokenRow.user_id, client);
      if (!user) {
        throw new AppError('This verification link is invalid.', {
          statusCode: 400,
          code: 'INVALID_VERIFICATION_TOKEN',
        });
      }

      await this.authTokenRepository.invalidateUnusedForUser(
        tokenRow.user_id,
        PURPOSE.EMAIL_VERIFICATION,
        client,
      );

      return {
        user: toPublicUser(user),
        alreadyVerified: false,
        message: 'Email verified successfully.',
      };
    });
  }

  /**
   * Resend a verification message.
   * Authenticated callers get an explicit outcome. Public callers always get
   * the same accepted payload so the response does not reveal whether the
   * address exists, is verified, or is suspended.
   * @param {{ email?: string, userId?: string, authenticated?: boolean }} input
   */
  async resendVerification({ email, userId, authenticated = false } = {}) {
    if (!authenticated) {
      return this.#publicResend(email);
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account no longer exists.', {
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      });
    }
    if (user.is_suspended === true) {
      throw new AppError('This account is suspended.', {
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
      });
    }
    if (user.email_verified_at) {
      return {
        outcome: 'already_verified',
        delivery: null,
        message: 'This email address is already verified.',
        user: toPublicUser(user),
      };
    }

    const latest = await this.authTokenRepository.findLatestUnused(
      user.id,
      PURPOSE.EMAIL_VERIFICATION,
    );
    if (latest && Date.now() - new Date(latest.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return {
        outcome: 'recent',
        delivery: null,
        message: 'A verification message was requested recently. Wait a minute before requesting another.',
      };
    }

    const sent = await this.#issueAndSendVerification(user);
    return {
      ...deliveryResult(sent),
      user: toPublicUser(user),
    };
  }

  async #publicResend(email) {
    const user = email ? await this.userRepository.findByEmail(email) : null;
    if (!user) {
      await getDummyHash();
      return publicResendResult();
    }
    if (user.email_verified_at || user.is_suspended === true) {
      return publicResendResult();
    }

    const latest = await this.authTokenRepository.findLatestUnused(
      user.id,
      PURPOSE.EMAIL_VERIFICATION,
    );
    if (latest && Date.now() - new Date(latest.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return publicResendResult();
    }

    try {
      await this.#issueAndSendVerification(user);
    } catch (err) {
      logSendFailure('public_verification_send_failed', user.id, err);
    }
    return publicResendResult();
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
          await emailSender(
            buildPasswordResetMessage({
              to: user.email,
              username: user.username,
              resetUrl,
            }),
          );
        });
      } catch (err) {
        logSendFailure('password_reset_send_failed', user.id, err);
      }
    } else {
      await getDummyHash();
    }

    return publicForgotResult();
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
    return withTransaction(async (client) => {
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
      return emailSender(
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
  setEmailSenderForTests,
  RESEND_COOLDOWN_MS,
};
