/**
 * @file ingestController.js
 * @description Ingestion Controller for AI Knowledge Inbox.
 * Handles POST /api/ingest for both text notes and web URLs.
 * Validates request schemas with Zod, invokes scraping and chunking pipelines,
 * and records documents and chunks in SQLite using atomic transactions.
 */

const crypto = require('crypto');
const { z } = require('zod');
const { getDatabase } = require('../config/database');
const logger = require('../config/logger');
const { scrapeUrl } = require('../services/scraperService');
const { chunkText } = require('../services/chunkingService');
const { generateEmbeddings } = require('../services/embeddingService');
const { vectorToBuffer } = require('../utils/similarity');

/**
 * Zod validation schema for POST /api/ingest.
 * Uses discriminated union to validate either a 'note'/'text' payload or a 'url' payload.
 */
const ingestSchema = z.discriminatedUnion('type', [
  // Text note ingestion
  z.object({
    type: z.enum(['note', 'text']),
    title: z.string().trim().max(255).optional(),
    content: z.string().trim().min(1, { message: 'Content cannot be empty.' }),
  }),
  // Web URL ingestion
  z.object({
    type: z.literal('url'),
    url: z.string().trim().min(1, { message: 'URL cannot be empty.' }),
    title: z.string().trim().max(255).optional(),
  }),
]);

/**
 * Derives a suitable title from content if none was provided.
 * @param {string} text
 * @returns {string}
 */
function deriveTitleFromText(text) {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 80) {
    return firstLine;
  }
  return `Note - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * POST /api/ingest
 * Ingests a raw text note or scraped webpage URL, chunks it, and saves it in SQLite.
 */
async function ingest(req, res, next) {
  const startTime = Date.now();

  try {
    // 1. Validate payload schema with Zod
    const validatedData = ingestSchema.parse(req.body);

    logger.info(`📥 Ingestion initiated for type: "${validatedData.type}"`, {
      type: validatedData.type,
      url: validatedData.url,
      hasTitle: !!validatedData.title,
    });

    let documentTitle = validatedData.title;
    let documentContent = '';
    let documentUrl = null;
    let normalizedType = validatedData.type === 'url' ? 'url' : 'note';

    // 2. Extract content based on ingestion type
    if (normalizedType === 'url') {
      const scraped = await scrapeUrl(validatedData.url);
      documentContent = scraped.content;
      documentUrl = scraped.url;
      documentTitle = documentTitle || scraped.title || 'Untitled Webpage';
    } else {
      documentContent = validatedData.content;
      documentTitle = documentTitle || deriveTitleFromText(documentContent);
    }

    // 3. Segment content into ~500 char chunks with ~100 char overlap
    const rawChunks = chunkText(documentContent, {
      targetChunkSize: 500,
      overlapSize: 100,
    });

    // 4. Check for existing duplicate document by URL or exact title/content
    const db = getDatabase();
    let existingItem = null;

    if (normalizedType === 'url' && documentUrl) {
      existingItem = db.prepare('SELECT id, title, type FROM items WHERE url = ?').get(documentUrl);
    } else {
      existingItem = db.prepare('SELECT id, title, type FROM items WHERE title = ? AND content = ?').get(documentTitle, documentContent);
    }

    const isUpdate = Boolean(existingItem);
    const itemId = isUpdate ? existingItem.id : crypto.randomUUID();

    const preparedChunks = rawChunks.map((chunk) => ({
      id: crypto.randomUUID(),
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      characterCount: chunk.characterCount,
    }));

    // 5. Generate vector embeddings for all chunks
    const chunkTexts = preparedChunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);
    const chunkBuffers = embeddings.map((vec) => vectorToBuffer(vec));

    // 6. Execute SQLite atomic database transaction
    const insertTransaction = db.transaction(() => {
      if (isUpdate) {
        // Delete previous chunks to re-index cleanly without duplicates
        db.prepare('DELETE FROM chunks WHERE item_id = ?').run(itemId);

        const updateItemStmt = db.prepare(`
          UPDATE items 
          SET title = ?, content = ?, url = ?, updated_at = datetime('now')
          WHERE id = ?
        `);
        updateItemStmt.run(documentTitle, documentContent, documentUrl, itemId);
      } else {
        // Insert new master document record
        const insertItemStmt = db.prepare(`
          INSERT INTO items (id, type, title, content, url, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        insertItemStmt.run(itemId, normalizedType, documentTitle, documentContent, documentUrl);
      }

      // Insert segmented chunks with vector embeddings stored as BLOBs
      const insertChunkStmt = db.prepare(`
        INSERT INTO chunks (id, item_id, chunk_index, text, embedding, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);

      for (let i = 0; i < preparedChunks.length; i++) {
        const chunk = preparedChunks[i];
        insertChunkStmt.run(chunk.id, itemId, chunk.chunkIndex, chunk.text, chunkBuffers[i]);
      }

      // Record operational audit log
      const insertLogStmt = db.prepare(`
        INSERT INTO logs (level, message, meta, timestamp)
        VALUES (?, ?, ?, datetime('now'))
      `);
      insertLogStmt.run(
        'info',
        `${isUpdate ? 'Updated' : 'Ingested'} ${normalizedType}: "${documentTitle}" (${preparedChunks.length} chunks)`,
        JSON.stringify({
          itemId,
          type: normalizedType,
          chunkCount: preparedChunks.length,
          contentLength: documentContent.length,
          isUpdate,
        })
      );
    });

    // Execute the transaction
    insertTransaction();

    const durationMs = Date.now() - startTime;
    logger.info(`✅ Successfully ingested item "${documentTitle}" [${itemId}] with ${preparedChunks.length} chunks in ${durationMs}ms`);

    // 6. Return structured 201 Created response
    return res.status(201).json({
      success: true,
      message: 'Knowledge ingested and chunked successfully',
      data: {
        id: itemId,
        type: normalizedType,
        title: documentTitle,
        url: documentUrl,
        contentLength: documentContent.length,
        chunkCount: preparedChunks.length,
        chunks: preparedChunks.map((c) => ({
          id: c.id,
          chunkIndex: c.chunkIndex,
          characterCount: c.characterCount,
          preview: c.text.length > 90 ? `${c.text.substring(0, 90)}...` : c.text,
        })),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('❌ Ingestion pipeline failed', {
      type: req.body?.type,
      url: req.body?.url,
      error: error.message,
    });
    next(error);
  }
}

module.exports = {
  ingest,
  ingestSchema,
};
