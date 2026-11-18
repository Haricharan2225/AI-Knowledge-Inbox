/**
 * @file itemController.js
 * @description Controller for Knowledge Library item management and Dashboard analytics.
 * Implements GET /api/items, GET /api/items/:id, DELETE /api/items/:id, and GET /api/stats.
 */

const { getDatabase } = require('../config/database');
const logger = require('../config/logger');
const { getVectorStats } = require('../services/vectorStore');

/**
 * GET /api/items
 * Retrieves saved knowledge items with optional type filtering and text search.
 */
function getItems(req, res, next) {
  try {
    const { type, search, limit = 50, offset = 0 } = req.query;
    const db = getDatabase();

    let whereClauses = [];
    let params = [];

    if (type && type !== 'all') {
      whereClauses.push('i.type = ?');
      params.push(type);
    }

    if (search && search.trim().length > 0) {
      whereClauses.push('(i.title LIKE ? OR i.content LIKE ? OR i.url LIKE ?)');
      const wildcard = `%${search.trim()}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT count(*) as total FROM items i ${whereSql}`;
    const totalCount = db.prepare(countSql).get(...params).total;

    const itemsSql = `
      SELECT 
        i.id,
        i.type,
        i.title,
        i.url,
        i.created_at,
        i.updated_at,
        length(i.content) as content_length,
        substr(i.content, 1, 160) as preview,
        (SELECT count(*) FROM chunks c WHERE c.item_id = i.id) as chunk_count
      FROM items i
      ${whereSql}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(itemsSql).all(...params, parseInt(limit, 10), parseInt(offset, 10));

    return res.status(200).json({
      success: true,
      total: totalCount,
      count: items.length,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      data: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        url: item.url,
        contentLength: item.content_length,
        preview: item.preview + (item.content_length > 160 ? '...' : ''),
        chunkCount: item.chunk_count,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    });
  } catch (error) {
    logger.error('Failed to retrieve items', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/items/:id
 * Retrieves full document details including its individual text chunks.
 */
function getItemById(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'NotFoundError',
        message: `Knowledge item with ID "${id}" was not found.`,
      });
    }

    const chunks = db
      .prepare(
        'SELECT id, chunk_index, text, (embedding IS NOT NULL) as has_embedding, created_at FROM chunks WHERE item_id = ? ORDER BY chunk_index ASC'
      )
      .all(id);

    return res.status(200).json({
      success: true,
      data: {
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        url: item.url,
        contentLength: item.content.length,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        chunks: chunks.map((c) => ({
          id: c.id,
          chunkIndex: c.chunk_index,
          text: c.text,
          characterCount: c.text.length,
          hasEmbedding: Boolean(c.has_embedding),
          createdAt: c.created_at,
        })),
      },
    });
  } catch (error) {
    logger.error(`Failed to retrieve item ${req.params.id}`, { error: error.message });
    next(error);
  }
}

/**
 * DELETE /api/items/:id
 * Deletes a document and its cascaded chunks.
 */
function deleteItem(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const existing = db.prepare('SELECT id, title, type FROM items WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'NotFoundError',
        message: `Cannot delete: Item with ID "${id}" does not exist.`,
      });
    }

    // Execute deletion within transaction
    const deleteTx = db.transaction(() => {
      // Because foreign_keys = ON and chunks.item_id references items(id) ON DELETE CASCADE,
      // deleting from items cascades, but we also explicitly ensure chunks are cleaned up.
      db.prepare('DELETE FROM chunks WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM items WHERE id = ?').run(id);

      db.prepare(`
        INSERT INTO logs (level, message, meta, timestamp)
        VALUES (?, ?, ?, datetime('now'))
      `).run(
        'info',
        `Deleted ${existing.type} "${existing.title}" [${id}]`,
        JSON.stringify({ itemId: id, title: existing.title, type: existing.type })
      );
    });

    deleteTx();

    logger.info(`🗑️ Deleted knowledge item "${existing.title}" [${id}]`);

    return res.status(200).json({
      success: true,
      message: `Knowledge item "${existing.title}" was deleted successfully.`,
      deletedId: id,
    });
  } catch (error) {
    logger.error(`Failed to delete item ${req.params.id}`, { error: error.message });
    next(error);
  }
}

/**
 * GET /api/stats
 * Dashboard metrics: item counts, chunk counts, vector coverage, and recent activity.
 */
function getStats(req, res, next) {
  try {
    const db = getDatabase();

    const totalItems = db.prepare('SELECT count(*) as count FROM items').get().count;
    const noteItems = db.prepare("SELECT count(*) as count FROM items WHERE type = 'note'").get().count;
    const urlItems = db.prepare("SELECT count(*) as count FROM items WHERE type = 'url'").get().count;

    const vectorStats = getVectorStats();

    // Fetch 5 most recently ingested items
    const recentItems = db
      .prepare(`
        SELECT id, type, title, url, created_at,
          (SELECT count(*) FROM chunks c WHERE c.item_id = items.id) as chunk_count
        FROM items
        ORDER BY created_at DESC
        LIMIT 5
      `)
      .all();

    // Fetch 5 most recent activity logs
    const recentLogs = db
      .prepare(`
        SELECT id, level, message, meta, timestamp
        FROM logs
        ORDER BY id DESC
        LIMIT 5
      `)
      .all();

    return res.status(200).json({
      success: true,
      data: {
        counts: {
          totalItems,
          notes: noteItems,
          urls: urlItems,
          totalChunks: vectorStats.totalChunks,
          embeddedChunks: vectorStats.embeddedChunks,
          missingEmbeddings: vectorStats.missingEmbeddings,
        },
        vectorEngine: {
          activeProvider: vectorStats.activeProvider,
        },
        recentItems: recentItems.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          url: item.url,
          chunkCount: item.chunk_count,
          createdAt: item.created_at,
        })),
        recentActivity: recentLogs.map((log) => ({
          id: log.id,
          level: log.level,
          message: log.message,
          timestamp: log.timestamp,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard stats', { error: error.message });
    next(error);
  }
}

module.exports = {
  getItems,
  getItemById,
  deleteItem,
  getStats,
};
