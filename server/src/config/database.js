/**
 * @file database.js
 * @description SQLite database connection and schema management using better-sqlite3.
 * Configures WAL mode for concurrent read/write performance, enforces foreign key constraints,
 * and initializes items, chunks, and logs tables with optimized indexes.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('./env');
const logger = require('./logger');

// Resolve database path relative to project structure
const dbPath = path.isAbsolute(env.DATABASE_PATH)
  ? env.DATABASE_PATH
  : path.resolve(__dirname, '../../', env.DATABASE_PATH);

// Ensure target directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

/**
 * Initializes and returns the SQLite database connection.
 * Creates schema and indexes idempotently on first boot.
 * @returns {Database.Database} The active SQLite database instance.
 */
function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = new Database(dbPath, {
      verbose: env.NODE_ENV === 'development' ? null : null, // Set to logger if SQL tracing needed
    });

    // 1. Enable WAL (Write-Ahead Logging) mode for enhanced concurrency and read performance
    dbInstance.pragma('journal_mode = WAL');

    // 2. Enforce foreign key constraints across relational tables
    dbInstance.pragma('foreign_keys = ON');

    // 3. Set synchronous mode to NORMAL for optimal balance between safety and write speed in WAL mode
    dbInstance.pragma('synchronous = NORMAL');

    logger.info(`📦 SQLite database connected successfully at: ${dbPath}`);

    // Initialize required schema
    initSchema(dbInstance);

    return dbInstance;
  } catch (error) {
    logger.error('Failed to initialize SQLite database connection', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Creates required tables (items, chunks, logs) and performance indexes if they do not exist.
 * @param {Database.Database} db
 */
function initSchema(db) {
  const schemaSql = `
    -- 1. Items table: Stores original ingested knowledge assets (text notes or scraped web URLs)
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('note', 'url')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Chunks table: Stores segmented text passages and binary vector embeddings for RAG retrieval
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    -- 3. Logs table: Stores operational and query activity logs for auditing and observability
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
    CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks(item_id);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
  `;

  db.exec(schemaSql);
  logger.info('✅ Database schema verified: items, chunks, and logs tables ready with indexes.');
}

/**
 * Gracefully closes the SQLite database connection.
 */
function closeDatabase() {
  if (dbInstance && dbInstance.open) {
    dbInstance.close();
    logger.info('🔒 SQLite database connection closed cleanly.');
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase,
};
