// Enforces role-based access control (RBAC) on protected routes.
//
// Authorization ONLY — it assumes authentication has already run and attached
// `req.user`. It answers "is this identity allowed to do this?" and never
// verifies tokens or loads users (that is `authenticate`).

const { ForbiddenError, UnauthorizedError } = require('../shared/errors/http-errors');
const { logSecurityEvent } = require('../shared/security/security-log');

/**
 * Factory: returns Express middleware that allows the request only when
 * `req.user.role` is one of the permitted roles.
 *
 * @param {...string} roles - one or more allowed role names (e.g. 'admin').
 * @returns {import('express').RequestHandler}
 */
function authorize(...roles) {
  const allowed = new Set(roles);

  return (req, _res, next) => {
    try {
      // authenticate must run first; without an identity there is nothing to authorize.
      if (!req.user) {
        throw new UnauthorizedError('Authentication is required.');
      }

      if (!allowed.has(req.user.role)) {
        logSecurityEvent(
          'permission_denied',
          { requiredRoles: [...allowed], actualRole: req.user.role },
          req,
        );
        throw new ForbiddenError('You do not have permission to perform this action.');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authorize };
