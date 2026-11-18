/**
 * @file server.js
 * @description Application entry point. Boots the Express HTTP server, validates database connectivity,
 * and sets up graceful shutdown listeners for system signals.
 */

const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { getDatabase, closeDatabase } = require('./config/database');
const { backfillMissingEmbeddings } = require('./services/vectorStore');

// Initialize database schema upon startup
try {
  getDatabase();
} catch (dbErr) {
  logger.error('CRITICAL: Failed to initialize database on startup', { error: dbErr.message });
  process.exit(1);
}

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Knowledge Inbox Server running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`);
  logger.info(`🩺 Health check accessible at: http://localhost:${env.PORT}/api/health`);

  // Run embedding backfill in background to ensure zero unindexed chunks
  backfillMissingEmbeddings().catch((err) => {
    logger.error('Background embedding backfill failed', { error: err.message });
  });
});

/**
 * Handles graceful shutdown on operating system signals.
 * @param {string} signal
 */
function handleGracefulShutdown(signal) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed successfully.');
    closeDatabase();
    process.exit(0);
  });

  // Force shutdown after 10 seconds timeout
  setTimeout(() => {
    logger.error('Forceful shutdown triggered after timeout.');
    process.exit(1);
  }, 10000).unref();
}

// OS process signal hooks
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// Uncaught exceptions & rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception occurred!', { error: err.message, stack: err.stack });
  handleGracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection!', { reason });
});
