'use strict';

const AppError = require('../utils/AppError');

// ─── Mongoose-specific error transformers ───────────────────────────────────

/**
 * Handles Mongoose CastError (e.g. invalid ObjectId format in req.params).
 * Returns a 400 with a message like "Invalid value for field 'orderId'."
 */
function handleCastError(err) {
  return new AppError(
    `Invalid value for field '${err.path}': '${err.value}'.`,
    400,
    'INVALID_FIELD'
  );
}

/**
 * Handles MongoDB duplicate key error (code 11000).
 * Returns a 409 Conflict with the duplicate field name.
 */
function handleDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue ? err.keyValue[field] : '';
  return new AppError(
    `Duplicate value for '${field}': '${value}'. Please use a different value.`,
    409,
    'DUPLICATE_KEY',
    { field, value }
  );
}

/**
 * Handles Mongoose ValidationError (schema-level validation failures).
 * Collects all field errors into a single response with `details`.
 */
function handleValidationError(err) {
  const fieldErrors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return new AppError(
    'Validation failed.',
    400,
    'VALIDATION_ERROR',
    fieldErrors
  );
}

/**
 * Handles JWT errors: expired or malformed tokens.
 */
function handleJWTError() {
  return new AppError('Invalid or expired token. Please log in again.', 401, 'INVALID_TOKEN');
}

// ─── Response senders ────────────────────────────────────────────────────────

/**
 * Development error response — includes full stack trace and raw error for debugging.
 */
function sendDevError(err, res) {
  res.status(err.statusCode || 500).json({
    success:    false,
    status:     err.status    || 'error',
    message:    err.message,
    code:       err.code      || null,
    details:    err.details   || null,
    stack:      err.stack,
    error:      err,
  });
}

/**
 * Production error response — sends only what the client needs.
 * Operational errors: send the specific message.
 * Programming errors: send a generic message (never expose internals).
 */
function sendProdError(err, res) {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success:  false,
      status:   err.status,
      message:  err.message,
      code:     err.code    || null,
      details:  err.details || null,
    });
  } else {
    // Log the full error — something unexpected happened
    console.error('UNHANDLED ERROR:', err);
    res.status(500).json({
      success:  false,
      status:   'error',
      message:  'Something went wrong. Please try again later.',
    });
  }
}

// ─── Main error handler middleware ────────────────────────────────────────────

/**
 * Global Express error-handling middleware.
 * Must be mounted AFTER all routes and other middleware in app.js.
 *
 * Handles:
 * - Mongoose CastError       → 400 Invalid field
 * - Mongoose ValidationError → 400 Validation failed
 * - MongoDB duplicate key    → 409 Conflict
 * - JWT errors               → 401 Unauthorized
 * - AppError instances       → status from the error
 * - Anything else            → 500 Internal Server Error
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Ensure we always have a statusCode and status
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || 'error';

  const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

  if (isDev) {
    sendDevError(err, res);
  } else {
    // Transform specific known error types into AppError instances
    let transformed = err;

    if (err.name === 'CastError')                           transformed = handleCastError(err);
    else if (err.code === 11000)                            transformed = handleDuplicateKeyError(err);
    else if (err.name === 'ValidationError')                transformed = handleValidationError(err);
    else if (err.name === 'JsonWebTokenError')              transformed = handleJWTError();
    else if (err.name === 'TokenExpiredError')              transformed = handleJWTError();

    sendProdError(transformed, res);
  }
};

module.exports = errorHandler;
