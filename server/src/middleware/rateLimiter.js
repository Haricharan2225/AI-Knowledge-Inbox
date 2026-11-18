/**
 * @file rateLimiter.js
 * @description Rate limiting middleware powered by express-rate-limit.
 * Protects resource-intensive endpoints (/api/ingest and /api/query) against abuse,
 * DDoS, and excessive LLM API quota consumption.
 */

const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

/**
 * Standard rate limiter for knowledge ingestion (POST /api/ingest).
 * Enforces a maximum of 20 ingestion requests per minute per IP.
 */
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // Max 20 ingestions per minute
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
  handler: (req, res, next, options) => {
    logger.warn(`⚠️ Rate limit exceeded on /api/ingest from IP: ${req.ip}`);
    return res.status(429).json({
      success: false,
      error: 'TooManyRequests',
      message: 'Rate limit exceeded: Too many knowledge ingestion requests from this IP. Please wait a minute before trying again.',
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    });
  },
});

/**
 * Standard rate limiter for AI queries (POST /api/query).
 * Enforces a maximum of 40 questions per minute per IP.
 */
const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 40, // Max 40 questions per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
  handler: (req, res, next, options) => {
    logger.warn(`⚠️ Rate limit exceeded on /api/query from IP: ${req.ip}`);
    return res.status(429).json({
      success: false,
      error: 'TooManyRequests',
      message: 'Rate limit exceeded: Too many question requests from this IP. Please wait a minute before trying again.',
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    });
  },
});

/**
 * Factory to create custom rate limiters for testing or custom routes.
 */
function createCustomLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, opts) => {
      return res.status(429).json({
        success: false,
        error: 'TooManyRequests',
        message: options.message || 'Rate limit exceeded.',
        retryAfterSeconds: Math.ceil(opts.windowMs / 1000),
      });
    },
    ...options,
  });
}

module.exports = {
  ingestLimiter,
  queryLimiter,
  createCustomLimiter,
};
