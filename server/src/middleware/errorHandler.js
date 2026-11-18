/**
 * @file errorHandler.js
 * @description Centralized Express error handler.
 * Sanitizes internal stack traces in production while returning informative structured JSON errors.
 */

const { ZodError } = require('zod');
const logger = require('../config/logger');
const env = require('../config/env');

function errorHandler(err, req, res, next) {
  // If response headers have already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle schema validation errors from Zod
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    logger.warn('Validation error occurred', {
      url: req.originalUrl,
      errors: formattedErrors,
    });

    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: formattedErrors,
    });
  }

  // Handle SQLite / Database specific errors
  if (err.name === 'SqliteError') {
    logger.error('Database query error', {
      error: err.message,
      code: err.code,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      error: 'Database Operation Failed',
      message: env.NODE_ENV === 'production' ? 'An internal database error occurred' : err.message,
    });
  }

  // General unhandled application errors
  logger.error('Unhandled server error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred on the server',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
