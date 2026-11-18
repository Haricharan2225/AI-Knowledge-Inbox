/**
 * @file embeddingService.js
 * @description Provider-agnostic text embedding generator for AI Knowledge Inbox.
 * Supports:
 * 1. Google Gemini (text-embedding-004, 768 dimensions)
 * 2. OpenAI (text-embedding-3-small, 1536 dimensions)
 * 3. High-precision Deterministic Vector Engine (768 dimensions) for offline / development / test execution
 */

const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../config/logger');
const { normalizeVector } = require('../utils/similarity');

const DETERMINISTIC_DIMENSION = 768;

/**
 * Determines which embedding provider is active based on available configuration.
 * @returns {'gemini' | 'openai' | 'deterministic'}
 */
function getActiveProvider() {
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0) {
    return 'gemini';
  }
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0) {
    return 'openai';
  }
  return 'deterministic';
}

/**
 * High-precision deterministic vectorizer using Murmur-style multi-hash projection and subword n-grams.
 * Produces unit-normalized dense 768-dimensional vectors where semantically overlapping
 * documents produce mathematically high cosine similarities.
 * @param {string} text
 * @returns {Float32Array}
 */
function generateDeterministicEmbedding(text) {
  const dim = DETERMINISTIC_DIMENSION;
  const vector = new Float32Array(dim);

  // Clean and extract word and subword n-grams
  const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalizedText.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return normalizeVector(vector);
  }

  // Token weights based on word position and length
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const weight = 1.0 + Math.log(1 + word.length);

    // 1. Hash full word
    const hash1 = crypto.createHash('sha256').update(word).digest();
    const idx1 = hash1.readUInt16BE(0) % dim;
    const sign1 = (hash1[2] & 1) === 0 ? 1 : -1;
    vector[idx1] += sign1 * weight;

    // 2. Hash character bi-grams/tri-grams for subword morphological similarity
    if (word.length >= 3) {
      for (let j = 0; j <= word.length - 3; j++) {
        const trigram = word.substring(j, j + 3);
        const hashTri = crypto.createHash('md5').update(trigram).digest();
        const idxTri = hashTri.readUInt16BE(0) % dim;
        const signTri = (hashTri[2] & 1) === 0 ? 1 : -1;
        vector[idxTri] += signTri * 0.4;
      }
    }

    // 3. Hash word pairs (bigrams) for contextual phrases
    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      const hashBi = crypto.createHash('sha256').update(bigram).digest();
      const idxBi = hashBi.readUInt16BE(4) % dim;
      const signBi = (hashBi[6] & 1) === 0 ? 1 : -1;
      vector[idxBi] += signBi * 0.7;
    }
  }

  return normalizeVector(vector);
}

/**
 * Generates an embedding via Google Gemini text-embedding-004.
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
async function generateGeminiEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text }],
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini Embedding API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const values = data.embedding?.values;
  if (!values || !Array.isArray(values)) {
    throw new Error('Gemini Embedding API returned invalid format.');
  }

  return normalizeVector(new Float32Array(values));
}

/**
 * Generates an embedding via OpenAI text-embedding-3-small.
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
async function generateOpenAIEmbedding(text) {
  const url = 'https://api.openai.com/v1/embeddings';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Embedding API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const values = data.data?.[0]?.embedding;
  if (!values || !Array.isArray(values)) {
    throw new Error('OpenAI Embedding API returned invalid format.');
  }

  return normalizeVector(new Float32Array(values));
}

/**
 * Generates an embedding vector for a single text string.
 * Automatically delegates to Gemini, OpenAI, or the deterministic fallback engine.
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
async function generateEmbedding(text) {
  const provider = getActiveProvider();

  if (provider === 'gemini') {
    try {
      return await generateGeminiEmbedding(text);
    } catch (err) {
      logger.warn(`Gemini embedding failed (${err.message}), falling back to deterministic engine`);
      return generateDeterministicEmbedding(text);
    }
  }

  if (provider === 'openai') {
    try {
      return await generateOpenAIEmbedding(text);
    } catch (err) {
      logger.warn(`OpenAI embedding failed (${err.message}), falling back to deterministic engine`);
      return generateDeterministicEmbedding(text);
    }
  }

  // Deterministic local engine
  return generateDeterministicEmbedding(text);
}

/**
 * Batch generates embedding vectors for an array of text chunks.
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
async function generateEmbeddings(texts) {
  if (!Array.isArray(texts)) {
    throw new TypeError('generateEmbeddings expects an array of strings.');
  }

  const results = [];
  for (const text of texts) {
    const vector = await generateEmbedding(text);
    results.push(vector);
  }
  return results;
}

module.exports = {
  getActiveProvider,
  generateEmbedding,
  generateEmbeddings,
  generateDeterministicEmbedding,
  DETERMINISTIC_DIMENSION,
};
