'use strict';

/**
 * AppError — structured application error with HTTP status.
 *
 * Usage:
 *   throw new AppError('Order not found', 404);
 *   throw new AppError('Access denied', 403);
 *
 * isOperational = true  → expected business-logic error (sent to client)
 * isOperational = false → programmer error / unexpected (logged, generic 500 sent)
 */
class AppError extends Error {
  /**
   * @param {string} message    Human-readable error description.
   * @param {number} statusCode HTTP status code (4xx or 5xx).
   * @param {string} [code]     Optional machine-readable error code (e.g. 'ORDER_NOT_FOUND').
   * @param {*}      [details]  Optional extra context (validation field errors, etc.).
   */
  constructor(message, statusCode, code = null, details = null) {
    super(message);

    this.statusCode = statusCode;
    // 4xx → 'fail' (client error), 5xx → 'error' (server error)
    this.status     = statusCode >= 500 ? 'error' : 'fail';
    this.code       = code;
    this.details    = details;
    // isOperational: true means this is an expected/anticipated error.
    // The global error handler only sends the message to the client for operational errors.
    this.isOperational = true;

    // Capture a clean stack trace that excludes the AppError constructor frame.
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
