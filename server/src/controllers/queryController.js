/**
 * @file queryController.js
 * @description Query Controller for AI Knowledge Inbox.
 * Handles POST /api/query endpoint, parses and validates questions with Zod,
 * executes the RAG pipeline, and logs audit events to SQLite.
 */

const { z } = require('zod');
const { getDatabase } = require('../config/database');
const logger = require('../config/logger');
const { processRagQuery } = require('../services/ragService');

/**
 * Zod schema validation for POST /api/query.
 */
const querySchema = z.object({
  question: z
    .string({ required_error: 'Question is required.' })
    .trim()
    .min(1, { message: 'Question cannot be empty.' }),
  topK: z
    .number()
    .int()
    .min(1, { message: 'topK must be at least 1' })
    .max(20, { message: 'topK cannot exceed 20' })
    .optional()
    .default(4),
  minSimilarity: z
    .number()
    .min(0.0, { message: 'minSimilarity must be >= 0.0' })
    .max(1.0, { message: 'minSimilarity must be <= 1.0' })
    .optional()
    .default(0.05),
  itemId: z
    .string()
    .uuid({ message: 'itemId must be a valid UUID' })
    .optional(),
});

/**
 * POST /api/query
 * Answers questions grounded in saved knowledge with citations.
 */
async function query(req, res, next) {
  try {
    // 1. Validate request payload
    const validatedData = querySchema.parse(req.body);

    logger.info(`💬 Received question: "${validatedData.question}"`, {
      topK: validatedData.topK,
      minSimilarity: validatedData.minSimilarity,
      itemId: validatedData.itemId,
    });

    // 2. Dispatch to RAG Service
    const result = await processRagQuery({
      question: validatedData.question,
      topK: validatedData.topK,
      minSimilarity: validatedData.minSimilarity,
      itemId: validatedData.itemId,
    });

    // 3. Record audit entry in SQLite logs table
    try {
      const db = getDatabase();
      const insertLogStmt = db.prepare(`
        INSERT INTO logs (level, message, meta, timestamp)
        VALUES (?, ?, ?, datetime('now'))
      `);
      insertLogStmt.run(
        'info',
        `Query answered: "${validatedData.question.substring(0, 80)}"`,
        JSON.stringify({
          question: validatedData.question,
          chunksRetrieved: result.metrics.chunksRetrieved,
          provider: result.metrics.provider,
          totalDurationMs: result.metrics.totalDurationMs,
        })
      );
    } catch (logErr) {
      logger.warn('Failed to insert log entry for query', { error: logErr.message });
    }

    // 4. Return structured HTTP 200 response
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('❌ Query execution failed', {
      error: error.message,
      body: req.body,
    });
    next(error);
  }
}

module.exports = {
  query,
  querySchema,
};
