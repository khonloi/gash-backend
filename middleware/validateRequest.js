'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

// ─── ObjectId Validators ──────────────────────────────────────────────────────

/**
 * Validates that one or more route params are valid MongoDB ObjectIds.
 *
 * Usage in routes:
 *   router.get('/:orderId', validateObjectId('orderId'), controller.getById);
 *   router.get('/:orderId/items/:itemId', validateObjectId('orderId', 'itemId'), handler);
 *
 * @param  {...string} paramNames  Names of req.params keys to validate.
 * @returns {import('express').RequestHandler}
 */
const validateObjectId = (...paramNames) => (req, res, next) => {
  for (const name of paramNames) {
    const value = req.params[name];
    if (!value || !mongoose.isValidObjectId(value)) {
      return next(new AppError(`Invalid '${name}': '${value}' is not a valid ID.`, 400, 'INVALID_ID'));
    }
  }
  next();
};

// ─── Body Validators ──────────────────────────────────────────────────────────

/**
 * Validates that all specified fields are present (non-null, non-undefined, non-empty-string)
 * in req.body.
 *
 * Usage:
 *   router.post('/', requireFields('title', 'message', 'type'), controller.create);
 *
 * @param  {...string} fields  Field names required in req.body.
 * @returns {import('express').RequestHandler}
 */
const requireFields = (...fields) => (req, res, next) => {
  const missing = fields.filter((f) => {
    const v = req.body[f];
    return v === undefined || v === null || v === '';
  });
  if (missing.length > 0) {
    return next(
      new AppError(
        `Missing required fields: ${missing.join(', ')}.`,
        400,
        'MISSING_FIELDS',
        missing.map((f) => ({ field: f, message: `'${f}' is required.` }))
      )
    );
  }
  next();
};

/**
 * Validates that a field in req.body (or req.query) is a valid MongoDB ObjectId.
 *
 * Usage:
 *   router.post('/feedback', validateBodyObjectId('variantId', 'orderId'), handler);
 *
 * @param  {...string} fieldNames  Body or query field names to validate.
 * @returns {import('express').RequestHandler}
 */
const validateBodyObjectId = (...fieldNames) => (req, res, next) => {
  const source = { ...req.body, ...req.query };
  for (const name of fieldNames) {
    const value = source[name];
    if (value !== undefined && value !== null && !mongoose.isValidObjectId(value)) {
      return next(new AppError(`Invalid '${name}': '${value}' is not a valid ID.`, 400, 'INVALID_ID'));
    }
  }
  next();
};

/**
 * Validates that a numeric field is within an inclusive range.
 *
 * Usage:
 *   validateRange('rating', 1, 5)
 *
 * @param {string} field  Field name in req.body.
 * @param {number} min    Minimum value (inclusive).
 * @param {number} max    Maximum value (inclusive).
 * @returns {import('express').RequestHandler}
 */
const validateRange = (field, min, max) => (req, res, next) => {
  const value = req.body[field];
  if (value !== undefined) {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) {
      return next(
        new AppError(
          `'${field}' must be a number between ${min} and ${max}.`,
          400,
          'OUT_OF_RANGE',
          [{ field, message: `Must be between ${min} and ${max}.` }]
        )
      );
    }
  }
  next();
};

/**
 * Validates that a string field does not exceed a maximum length.
 *
 * Usage:
 *   validateMaxLength('cancelReason', 500)
 *
 * @param {string} field      Field name in req.body.
 * @param {number} maxLength  Maximum allowed character count.
 * @returns {import('express').RequestHandler}
 */
const validateMaxLength = (field, maxLength) => (req, res, next) => {
  const value = req.body[field];
  if (value !== undefined && typeof value === 'string' && value.length > maxLength) {
    return next(
      new AppError(
        `'${field}' cannot exceed ${maxLength} characters (got ${value.length}).`,
        400,
        'TOO_LONG',
        [{ field, message: `Maximum length is ${maxLength} characters.` }]
      )
    );
  }
  next();
};

/**
 * Validates that a field value is one of the allowed enum values.
 *
 * Usage:
 *   validateEnum('paymentMethod', ['COD', 'VNPAY'])
 *
 * @param {string}   field   Field name in req.body.
 * @param {string[]} values  Array of allowed values.
 * @returns {import('express').RequestHandler}
 */
const validateEnum = (field, values) => (req, res, next) => {
  const value = req.body[field];
  if (value !== undefined && !values.includes(value)) {
    return next(
      new AppError(
        `'${field}' must be one of: ${values.join(', ')}.`,
        400,
        'INVALID_ENUM',
        [{ field, message: `Allowed values: ${values.join(', ')}.` }]
      )
    );
  }
  next();
};

// ─── Pagination Helpers ───────────────────────────────────────────────────────

/**
 * Parses and validates offset-based pagination query params (?page=1&limit=20).
 * Attaches `req.pagination` = { page, limit, skip } for use in controllers.
 *
 * Defaults: page=1, limit=20, max limit=100.
 *
 * Usage in routes:
 *   router.get('/', parsePagination(), controller.getAll);
 *
 * Usage in controllers:
 *   const { page, limit, skip } = req.pagination;
 *   const items = await Model.find(filter).skip(skip).limit(limit);
 *
 * @param {number} [defaultLimit=20] Default page size.
 * @param {number} [maxLimit=100]    Maximum allowed page size.
 * @returns {import('express').RequestHandler}
 */
const parsePagination = (defaultLimit = 20, maxLimit = 100) => (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  const skip  = (page - 1) * limit;
  req.pagination = { page, limit, skip };
  next();
};

/**
 * Builds a standardized paginated response envelope.
 *
 * Usage in controllers:
 *   const [items, total] = await Promise.all([
 *     Model.find(filter).skip(skip).limit(limit),
 *     Model.countDocuments(filter),
 *   ]);
 *   res.json(paginatedResponse(items, total, req.pagination));
 *
 * Response shape:
 * {
 *   success: true,
 *   data: [...],
 *   pagination: { total, page, limit, totalPages, hasNext, hasPrev }
 * }
 *
 * @param {Array}  data        The items for the current page.
 * @param {number} total       Total number of matching documents.
 * @param {{page: number, limit: number}} pagination  From req.pagination.
 * @param {object} [extra]     Any additional top-level fields to merge.
 */
const paginatedResponse = (data, total, pagination, extra = {}) => {
  const { page, limit } = pagination;
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    ...extra,
  };
};

module.exports = {
  validateObjectId,
  requireFields,
  validateBodyObjectId,
  validateRange,
  validateMaxLength,
  validateEnum,
  parsePagination,
  paginatedResponse,
};
