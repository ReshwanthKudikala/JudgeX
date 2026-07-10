// Runs a validator schema against the incoming request.
//
// Generic Zod runner: validates a single request part (body|query|params),
// replaces it with the parsed/typed value, and forwards a ValidationError to
// the global error handler on failure. Keeps validation out of controllers.

const { ValidationError } = require('../shared/errors/http-errors');

/**
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} [source='body']
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('Request validation failed.', details));
    }
    // Use the parsed (coerced/stripped) value downstream.
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };
