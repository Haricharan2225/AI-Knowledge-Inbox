/**
 * @file vectorStore.js
 * @description SQLite vector search engine and persistence layer for RAG retrieval.
 * Features Hybrid Search combining Dense Vector Cosine Similarity and Sparse BM25 Lexical Ranking,
 * content deduplication, adaptive score filtering, and automated embedding backfill.
 */

const { getDatabase } = require('../config/database');
const logger = require('../config/logger');
const { cosineSimilarity, bufferToVector, vectorToBuffer } = require('../utils/similarity');
const { generateEmbedding, getActiveProvider } = require('./embeddingService');
const { scoreCorpusBM25 } = require('./bm25Service');

/**
 * Searches stored chunks using Hybrid Search (Dense Cosine Similarity + BM25 Lexical Matching).
 * @param {Float32Array|number[]} queryVector - The question/query embedding vector.
 * @param {object} [options]
 * @param {string} [options.rawQuery] - The original text question for BM25 keyword matching.
 * @param {number} [options.topK=4] - Number of top results to return.
 * @param {number} [options.minSimilarity=0.12] - Minimum hybrid score threshold.
 * @param {string} [options.itemId] - Optional item ID filter to restrict search to a specific document.
 * @returns {Array<{ chunkId: string, itemId: string, title: string, url: string|null, type: string, chunkIndex: number, text: string, similarity: number }>}
 */
function searchSimilarChunks(queryVector, options = {}) {
  const topK = options.topK || 4;
  const minSimilarity = options.minSimilarity !== undefined ? options.minSimilarity : 0.12;
  const itemId = options.itemId || null;
  const rawQuery = options.rawQuery || '';

  const db = getDatabase();

  let querySql = `
    SELECT 
      c.id AS chunk_id,
      c.item_id,
      c.chunk_index,
      c.text,
      c.embedding,
      i.title,
      i.url,
      i.type
    FROM chunks c
    JOIN items i ON c.item_id = i.id
    WHERE c.embedding IS NOT NULL
  `;
  const params = [];

  if (itemId) {
    querySql += ' AND c.item_id = ?';
    params.push(itemId);
  }

  const rows = db.prepare(querySql).all(...params);
  if (rows.length === 0) return [];

  // 1. Compute BM25 scores across corpus if raw query string is provided
  let bm25Scores = new Map();
  let maxBm25 = 0.0;

  if (rawQuery.trim().length > 0) {
    const corpus = rows.map((r) => ({ id: r.chunk_id, text: r.text }));
    bm25Scores = scoreCorpusBM25(rawQuery, corpus);
    for (const score of bm25Scores.values()) {
      if (score > maxBm25) maxBm25 = score;
    }
  }

  // 2. Score every chunk using Hybrid Combination (Dense Cosine + Sparse BM25)
  const scoredChunks = [];

  for (const row of rows) {
    const chunkVector = bufferToVector(row.embedding);
    if (!chunkVector || chunkVector.length !== queryVector.length) continue;

    const denseSim = cosineSimilarity(queryVector, chunkVector);
    const rawBm25 = bm25Scores.get(row.chunk_id) || 0.0;
    const normalizedBm25 = maxBm25 > 0 ? rawBm25 / maxBm25 : 0.0;

    // Hybrid formula:
    // If BM25 has an exact term match (e.g. acronyms like JVM, OOP), it provides strong precision boost.
    // Otherwise, dense semantic cosine similarity guides the retrieval.
    let hybridScore = 0.0;
    if (maxBm25 > 0) {
      hybridScore = 0.45 * Math.max(0, denseSim) + 0.55 * normalizedBm25;
    } else {
      hybridScore = Math.max(0, denseSim);
    }

    scoredChunks.push({
      chunkId: row.chunk_id,
      itemId: row.item_id,
      title: row.title,
      url: row.url,
      type: row.type,
      chunkIndex: row.chunk_index,
      text: row.text,
      similarity: parseFloat(hybridScore.toFixed(4)),
      denseScore: parseFloat(denseSim.toFixed(4)),
      bm25Score: parseFloat(normalizedBm25.toFixed(4)),
    });
  }

  // 3. Sort descending by hybrid similarity score
  scoredChunks.sort((a, b) => b.similarity - a.similarity);

  if (scoredChunks.length === 0) return [];

  // 4. Adaptive Thresholding:
  // If the top match score is very low, or drops off dramatically, filter out noise
  const topScore = scoredChunks[0].similarity;
  if (topScore < minSimilarity) {
    return [];
  }

  // 5. Diversity Deduplication:
  // Avoid returning identical texts or multiple duplicate documents that repeat the exact same excerpt
  const seenTexts = new Set();
  const seenItems = new Map(); // itemId -> count of chunks from this item
  const deduplicated = [];

  for (const chunk of scoredChunks) {
    // Only accept chunks that are within 50% of the top score (cuts out unrelated long-tail noise like Example Domain)
    if (chunk.similarity < Math.max(minSimilarity, topScore * 0.45)) {
      continue;
    }

    // Normalized excerpt fingerprint to eliminate duplicate ingested copies
    const textFingerprint = chunk.text.trim().substring(0, 100);
    if (seenTexts.has(textFingerprint)) {
      continue;
    }

    // Limit chunks per item to 2 to ensure diversity across distinct documents
    const itemCount = seenItems.get(chunk.itemId) || 0;
    if (itemCount >= 2) {
      continue;
    }

    seenTexts.add(textFingerprint);
    seenItems.set(chunk.itemId, itemCount + 1);
    deduplicated.push(chunk);

    if (deduplicated.length >= topK) {
      break;
    }
  }

  return deduplicated;
}

/**
 * Scans for chunks without embeddings and generates/persists their vectors.
 * Ensures backward compatibility with Phase 1 / Phase 2 records.
 * @returns {Promise<number>} Count of backfilled chunks.
 */
async function backfillMissingEmbeddings() {
  const db = getDatabase();
  const unindexed = db.prepare('SELECT id, text FROM chunks WHERE embedding IS NULL').all();

  if (unindexed.length === 0) {
    return 0;
  }

  logger.info(`🔄 Backfilling embeddings for ${unindexed.length} unindexed chunks...`);

  const updateStmt = db.prepare('UPDATE chunks SET embedding = ? WHERE id = ?');
  let updatedCount = 0;

  for (const chunk of unindexed) {
    try {
      const vector = await generateEmbedding(chunk.text);
      const buffer = vectorToBuffer(vector);
      updateStmt.run(buffer, chunk.id);
      updatedCount++;
    } catch (err) {
      logger.error(`Failed to generate embedding for chunk ${chunk.id}: ${err.message}`);
    }
  }

  logger.info(`✅ Backfill complete. Generated and saved embeddings for ${updatedCount} chunks.`);
  return updatedCount;
}

/**
 * Returns diagnostic statistics regarding vector coverage in SQLite.
 * @returns {object}
 */
function getVectorStats() {
  const db = getDatabase();
  const totalChunks = db.prepare('SELECT count(*) as count FROM chunks').get().count;
  const embeddedChunks = db.prepare('SELECT count(*) as count FROM chunks WHERE embedding IS NOT NULL').get().count;

  return {
    totalChunks,
    embeddedChunks,
    missingEmbeddings: totalChunks - embeddedChunks,
    activeProvider: getActiveProvider(),
  };
}

module.exports = {
  searchSimilarChunks,
  backfillMissingEmbeddings,
  getVectorStats,
};
