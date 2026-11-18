/**
 * @file api.js
 * @description Primary API router for AI Knowledge Inbox.
 * Houses health checks and endpoint mounts for ingestion, retrieval, and RAG query.
 */

const express = require('express');
const { getDatabase } = require('../config/database');
const ingestController = require('../controllers/ingestController');
const queryController = require('../controllers/queryController');
const itemController = require('../controllers/itemController');
const { ingestLimiter, queryLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const { generateEmbedding } = require('../services/embeddingService');
const { searchSimilarChunks, getVectorStats } = require('../services/vectorStore');

/**
 * @route   GET /api/stats
 * @desc    Get dashboard metrics, total items, chunks, embeddings, and recent activity
 * @access  Public
 */
router.get('/stats', itemController.getStats);

/**
 * @route   GET /api/items
 * @desc    Get all saved knowledge items with filtering and search
 * @access  Public
 */
router.get('/items', itemController.getItems);

/**
 * @route   GET /api/items/:id
 * @desc    Get full knowledge document details with its individual chunks
 * @access  Public
 */
router.get('/items/:id', itemController.getItemById);

/**
 * @route   DELETE /api/items/:id
 * @desc    Delete a knowledge item and its chunks
 * @access  Public
 */
router.delete('/items/:id', itemController.deleteItem);

/**
 * @route   POST /api/ingest
 * @desc    Ingest text notes or website URLs, extract text, chunk, and persist in SQLite
 * @access  Public (Rate limited to 20 req/min)
 */
router.post('/ingest', ingestLimiter, ingestController.ingest);

/**
 * @route   POST /api/query
 * @desc    RAG Query: Answer user questions grounded in saved knowledge with citations
 * @access  Public (Rate limited to 40 req/min)
 */
router.post('/query', queryLimiter, queryController.query);

/**
 * @route   GET /api/search
 * @desc    Semantic search across stored knowledge chunks using cosine similarity
 * @access  Public
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, topK, minSimilarity, itemId } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Query parameter "q" is required for semantic search.',
      });
    }

    const queryVector = await generateEmbedding(q.trim());
    const matches = searchSimilarChunks(queryVector, {
      topK: topK ? parseInt(topK, 10) : 5,
      minSimilarity: minSimilarity ? parseFloat(minSimilarity) : 0.0,
      itemId,
    });

    return res.status(200).json({
      success: true,
      query: q.trim(),
      totalMatches: matches.length,
      data: matches,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/health
 * @desc    System health check verifying database connection and table counts
 * @access  Public
 */
router.get('/health', (req, res, next) => {
  try {
    const db = getDatabase();

    // Verify database connectivity by checking table schema
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'chunks', 'logs') ORDER BY name ASC;"
      )
      .all();

    // Fetch quick record counts
    const itemCount = db.prepare('SELECT count(*) as count FROM items').get().count;
    const chunkCount = db.prepare('SELECT count(*) as count FROM chunks').get().count;
    const logCount = db.prepare('SELECT count(*) as count FROM logs').get().count;

    const vectorStats = getVectorStats();

    return res.status(200).json({
      success: true,
      status: 'operational',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        engine: 'better-sqlite3',
        verifiedTables: tables.map((t) => t.name),
        counts: {
          items: itemCount,
          chunks: chunkCount,
          logs: logCount,
          embeddedChunks: vectorStats.embeddedChunks,
          missingEmbeddings: vectorStats.missingEmbeddings,
        },
        vectorEngine: {
          activeProvider: vectorStats.activeProvider,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
