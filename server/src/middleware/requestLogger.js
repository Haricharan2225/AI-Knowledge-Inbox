/**
 * @file requestLogger.js
 * @description HTTP request logging middleware measuring response times and logging structured metadata.
 */

const logger = require('../config/logger');

function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    const logMeta = {
      method,
      url: originalUrl,
      statusCode,
      durationMs: duration,
      ip: ip || req.connection.remoteAddress,
    };

    if (statusCode >= 500) {
      logger.error(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logMeta);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logMeta);
    } else {
      logger.info(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logMeta);
    }
  });

  next();
}

module.exports = requestLogger;
