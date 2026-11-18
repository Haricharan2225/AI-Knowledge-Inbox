/**
 * @file ragService.js
 * @description Orchestrator for the Retrieval-Augmented Generation (RAG) pipeline.
 * Coordinates query embedding, semantic Top-K vector retrieval from SQLite,
 * context prompt assembly, LLM synthesis, source citation resolution, and latency metrics.
 */

const logger = require('../config/logger');
const { generateEmbedding } = require('./embeddingService');
const { searchSimilarChunks } = require('./vectorStore');
const { generateAnswer } = require('./llmService');

const DEFAULT_TOP_K = 4;
const DEFAULT_MIN_SIMILARITY = 0.05;

/**
 * Executes the complete RAG query pipeline for a user question.
 * @param {object} params
 * @param {string} params.question - The user query to answer.
 * @param {number} [params.topK=4] - Number of top-ranked chunks to retrieve.
 * @param {number} [params.minSimilarity=0.05] - Minimum cosine similarity threshold.
 * @param {string} [params.itemId] - Optional document ID filter.
 * @returns {Promise<{
 *   question: string,
 *   answer: string,
 *   sources: Array<{
 *     sourceNumber: number,
 *     chunkId: string,
 *     itemId: string,
 *     title: string,
 *     url: string|null,
 *     type: string,
 *     chunkIndex: number,
 *     similarity: number,
 *     excerpt: string,
 *     isCited: boolean
 *   }>,
 *   metrics: {
 *     retrievalDurationMs: number,
 *     generationDurationMs: number,
 *     totalDurationMs: number,
 *     chunksRetrieved: number,
 *     provider: string
 *   }
 * }>}
 */
async function processRagQuery({ question, topK = DEFAULT_TOP_K, minSimilarity = DEFAULT_MIN_SIMILARITY, itemId }) {
  const totalStartTime = Date.now();
  logger.info(`🔍 RAG pipeline initiated for question: "${question}" (topK=${topK}, minSim=${minSimilarity})`);

  // -------------------------------------------------------------
  // Step 1: Retrieval Phase
  // -------------------------------------------------------------
  const retrievalStartTime = Date.now();

  // Generate question embedding vector
  const queryVector = await generateEmbedding(question);

  // Search SQLite vector store using Hybrid Search (Dense + BM25)
  const matchedChunks = searchSimilarChunks(queryVector, {
    topK,
    minSimilarity,
    itemId,
    rawQuery: question,
  });

  const retrievalDurationMs = Date.now() - retrievalStartTime;
  logger.info(`⚡ Retrieval complete: Found ${matchedChunks.length} chunks in ${retrievalDurationMs}ms`);

  // Fast-path: If no chunks met similarity threshold, return out-of-context response immediately
  if (matchedChunks.length === 0) {
    const totalDurationMs = Date.now() - totalStartTime;
    return {
      question,
      answer: 'I do not have enough information in the saved knowledge to answer this question.',
      sources: [],
      metrics: {
        retrievalDurationMs,
        generationDurationMs: 0,
        totalDurationMs,
        chunksRetrieved: 0,
        provider: 'guardrail',
      },
    };
  }

  // -------------------------------------------------------------
  // Step 2: Context Preparation & Numbered Citations
  // -------------------------------------------------------------
  const contextChunks = matchedChunks.map((chunk, index) => ({
    sourceNumber: index + 1,
    chunkId: chunk.chunkId,
    itemId: chunk.itemId,
    title: chunk.title,
    url: chunk.url,
    type: chunk.type,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
    text: chunk.text,
  }));

  // -------------------------------------------------------------
  // Step 3: LLM Answer Synthesis Phase
  // -------------------------------------------------------------
  const generationStartTime = Date.now();

  const { answer, provider } = await generateAnswer({
    question,
    contextChunks,
  });

  const generationDurationMs = Date.now() - generationStartTime;
  const totalDurationMs = Date.now() - totalStartTime;

  // -------------------------------------------------------------
  // Step 4: Strict Citation Resolution
  // -------------------------------------------------------------
  const isDeclined = answer.toLowerCase().includes('not have enough information');

  let finalSources = [];

  if (!isDeclined) {
    // Only include sources that were genuinely referenced in the answer
    finalSources = contextChunks
      .map((chunk) => {
        const citationTag = `[Source ${chunk.sourceNumber}]`;
        const isCited = answer.includes(citationTag);

        return {
          sourceNumber: chunk.sourceNumber,
          chunkId: chunk.chunkId,
          itemId: chunk.itemId,
          title: chunk.title,
          url: chunk.url,
          type: chunk.type,
          chunkIndex: chunk.chunkIndex,
          similarity: chunk.similarity,
          excerpt: chunk.text.length > 200 ? `${chunk.text.substring(0, 200)}...` : chunk.text,
          isCited,
        };
      })
      .filter((s) => s.isCited || (contextChunks.length === 1 && s.similarity >= minSimilarity));
  }

  logger.info(`✨ RAG answer generated in ${totalDurationMs}ms via [${provider.toUpperCase()}] with ${finalSources.length} cited sources`);

  return {
    question,
    answer,
    sources: finalSources,
    metrics: {
      retrievalDurationMs,
      generationDurationMs,
      totalDurationMs,
      chunksRetrieved: matchedChunks.length,
      sourcesCited: finalSources.length,
      provider,
    },
  };
}

module.exports = {
  processRagQuery,
  DEFAULT_TOP_K,
  DEFAULT_MIN_SIMILARITY,
};
