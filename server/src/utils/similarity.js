/**
 * @file similarity.js
 * @description High-performance vector mathematics and SQLite BLOB serialization utilities.
 * Handles cosine similarity, Euclidean vector normalization, and IEEE 754 Float32Array conversions.
 */

/**
 * Computes the cosine similarity between two floating-point vectors:
 * similarity = (A · B) / (||A|| * ||B||)
 * @param {Float32Array|number[]} vecA
 * @param {Float32Array|number[]} vecB
 * @returns {number} Cosine similarity score between -1.0 and 1.0
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB) {
    throw new Error('Both vectors must be provided for similarity computation.');
  }

  if (vecA.length !== vecB.length) {
    throw new Error(`Vector dimension mismatch: vector A (${vecA.length}) vs vector B (${vecB.length})`);
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0.0;
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Bound to [-1.0, 1.0] to prevent floating point inaccuracies beyond boundaries
  return Math.max(-1.0, Math.min(1.0, similarity));
}

/**
 * Normalizes a vector to unit length (Euclidean L2 norm = 1.0).
 * @param {Float32Array|number[]} vector
 * @returns {Float32Array}
 */
function normalizeVector(vector) {
  let norm = 0.0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }

  norm = Math.sqrt(norm);
  const normalized = new Float32Array(vector.length);

  if (norm === 0) {
    return normalized;
  }

  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i] / norm;
  }

  return normalized;
}

/**
 * Serializes a numeric vector or Float32Array into a Node.js Buffer for SQLite BLOB storage.
 * @param {Float32Array|number[]} vector
 * @returns {Buffer} Binary buffer representing IEEE 754 32-bit floats.
 */
function vectorToBuffer(vector) {
  if (!vector || vector.length === 0) {
    throw new Error('Cannot serialize empty or undefined vector.');
  }

  const float32 = vector instanceof Float32Array ? vector : new Float32Array(vector);
  return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);
}

/**
 * Deserializes an SQLite BLOB Buffer into a Float32Array vector.
 * @param {Buffer} buffer
 * @returns {Float32Array|null}
 */
function bufferToVector(buffer) {
  if (!buffer) {
    return null;
  }

  // Ensure byte length is a multiple of 4 bytes (Float32)
  if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error(`Corrupted vector buffer: byteLength (${buffer.byteLength}) is not a multiple of 4.`);
  }

  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
  );
}

module.exports = {
  cosineSimilarity,
  normalizeVector,
  vectorToBuffer,
  bufferToVector,
};
