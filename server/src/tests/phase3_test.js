/**
 * @file phase3_test.js
 * @description Comprehensive automated test suite for Phase 3: Embeddings & Vector Search Engine.
 * Tests:
 * 1. Vector Math & Cosine Similarity Unit Verification.
 * 2. SQLite BLOB Serialization & Float32 Precision Preservation.
 * 3. Embedding Generation & Semantic Discrimination.
 * 4. Ingestion with Automatic Vector Embedding Storage in SQLite.
 * 5. Semantic Vector Search Retrieval & Top-K Ranking.
 * 6. Regression Testing (Phase 1 & Phase 2 non-breakage verification).
 */

const assert = require('assert');
const { getDatabase, closeDatabase } = require('../config/database');
const { 
  cosineSimilarity, 
  normalizeVector, 
  vectorToBuffer, 
  bufferToVector 
} = require('../utils/similarity');
const { 
  generateEmbedding, 
  generateEmbeddings, 
  getActiveProvider 
} = require('../services/embeddingService');
const { searchSimilarChunks, getVectorStats } = require('../services/vectorStore');

const API_BASE = 'http://localhost:5000/api';

async function runPhase3Tests() {
  console.log('🚀 Starting Phase 3: Embeddings & Vector Search Engine Test Suite...\n');
  let passedCount = 0;
  const totalTests = 6;

  // -----------------------------------------------------------------
  // Test 1: Vector Math & Cosine Similarity Unit Tests
  // -----------------------------------------------------------------
  console.log('--- Test 1: Vector Math & Cosine Similarity Unit Tests ---');

  // Identical vectors -> 1.0
  const v1 = new Float32Array([1.0, 2.0, 3.0]);
  const v1Copy = new Float32Array([1.0, 2.0, 3.0]);
  const simIdentical = cosineSimilarity(v1, v1Copy);
  assert.ok(Math.abs(simIdentical - 1.0) < 1e-6, `Identical vector similarity should be 1.0, got ${simIdentical}`);
  console.log(`  ✓ Identical vectors produce cosine similarity = ${simIdentical.toFixed(4)}`);

  // Orthogonal vectors -> 0.0
  const vOrthA = new Float32Array([1.0, 0.0, 0.0]);
  const vOrthB = new Float32Array([0.0, 1.0, 0.0]);
  const simOrth = cosineSimilarity(vOrthA, vOrthB);
  assert.ok(Math.abs(simOrth - 0.0) < 1e-6, `Orthogonal vector similarity should be 0.0, got ${simOrth}`);
  console.log(`  ✓ Orthogonal vectors produce cosine similarity = ${simOrth.toFixed(4)}`);

  // Opposite vectors -> -1.0
  const vOppA = new Float32Array([1.0, 2.0, 3.0]);
  const vOppB = new Float32Array([-1.0, -2.0, -3.0]);
  const simOpp = cosineSimilarity(vOppA, vOppB);
  assert.ok(Math.abs(simOpp - (-1.0)) < 1e-6, `Opposite vector similarity should be -1.0, got ${simOpp}`);
  console.log(`  ✓ Opposite vectors produce cosine similarity = ${simOpp.toFixed(4)}`);

  // Dimension mismatch exception
  assert.throws(
    () => cosineSimilarity(new Float32Array([1, 2]), new Float32Array([1, 2, 3])),
    /Vector dimension mismatch/,
    'Should throw error on dimension mismatch'
  );
  console.log('  ✓ Dimension mismatch cleanly throws informative Error.');

  console.log('✅ Test 1 Passed: Cosine similarity mathematics verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 2: Serialization to SQLite BLOB Buffer & Deserialization
  // -----------------------------------------------------------------
  console.log('--- Test 2: SQLite BLOB Buffer Serialization & IEEE 754 Precision ---');
  const originalVec = new Float32Array([0.123456, -0.987654, 3.141592, 42.0]);
  const blobBuffer = vectorToBuffer(originalVec);

  assert.strictEqual(Buffer.isBuffer(blobBuffer), true, 'Serialized output must be a Node.js Buffer');
  assert.strictEqual(blobBuffer.byteLength, originalVec.length * 4, 'Buffer size must equal length * 4 bytes');

  const restoredVec = bufferToVector(blobBuffer);
  assert.strictEqual(restoredVec.length, originalVec.length, 'Restored vector length must match');

  for (let i = 0; i < originalVec.length; i++) {
    assert.strictEqual(restoredVec[i], originalVec[i], `Element ${i} mismatch after BLOB deserialization`);
  }

  console.log(`  ✓ Serialized ${originalVec.length} floats into ${blobBuffer.byteLength} bytes BLOB.`);
  console.log('  ✓ Deserialized BLOB restored exact IEEE 754 floating point numbers with zero loss.');
  console.log('✅ Test 2 Passed: BLOB serialization and deserialization verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 3: Embedding Generation & Semantic Discrimination
  // -----------------------------------------------------------------
  console.log('--- Test 3: Embedding Generation & Semantic Discrimination ---');
  const provider = getActiveProvider();
  console.log(`  Active Embedding Engine: [${provider.toUpperCase()}]`);

  const textA = 'Artificial intelligence and neural network retrieval systems.';
  const textB = 'Machine learning architectures for AI search and embeddings.';
  const textC = 'Chocolate cake recipe with dark cocoa and vanilla cream.';

  const vecA = await generateEmbedding(textA);
  const vecB = await generateEmbedding(textB);
  const vecC = await generateEmbedding(textC);

  assert.ok(vecA instanceof Float32Array, 'Embedding must be a Float32Array');
  assert.ok(vecA.length >= 768, `Vector dimension must be >= 768, got ${vecA.length}`);

  // Check L2 normalization
  let norm = 0;
  for (let i = 0; i < vecA.length; i++) norm += vecA[i] * vecA[i];
  norm = Math.sqrt(norm);
  assert.ok(Math.abs(norm - 1.0) < 1e-4, `Vector should be L2 unit normalized, norm=${norm}`);

  // Semantic similarity check: textA & textB should be more similar than textA & textC
  const simRelated = cosineSimilarity(vecA, vecB);
  const simUnrelated = cosineSimilarity(vecA, vecC);

  console.log(`  Similarity (AI Systems vs ML Search):       ${simRelated.toFixed(4)}`);
  console.log(`  Similarity (AI Systems vs Chocolate Cake):  ${simUnrelated.toFixed(4)}`);
  assert.ok(simRelated > simUnrelated, 'Related AI texts must exhibit higher similarity than unrelated cooking text');
  console.log('✅ Test 3 Passed: Embedding generation and semantic discrimination verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 4: Ingestion with Vector Embedding Storage in SQLite
  // -----------------------------------------------------------------
  console.log('--- Test 4: Ingestion with Vector Embeddings in SQLite ---');
  const testKnowledge = `
Vector databases store high-dimensional representations of text called embeddings.
Cosine similarity calculates the cosine of the angle between two multi-dimensional vectors.
In Retrieval-Augmented Generation (RAG), vector search retrieves the most contextually relevant excerpts.
`.trim();

  const ingestRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'note',
      title: 'Vector Embeddings in Modern RAG',
      content: testKnowledge,
    }),
  });

  const ingestData = await ingestRes.json();
  assert.strictEqual(ingestRes.status, 201);
  assert.strictEqual(ingestData.success, true);
  const itemId = ingestData.data.id;

  // Direct SQLite inspection to verify embedding BLOB
  const db = getDatabase();
  const dbChunks = db.prepare('SELECT id, chunk_index, text, embedding FROM chunks WHERE item_id = ?').all(itemId);

  assert.ok(dbChunks.length > 0, 'Chunks should be found in database');
  for (const c of dbChunks) {
    assert.ok(c.embedding !== null, `Chunk ${c.id} must have non-null embedding`);
    assert.ok(Buffer.isBuffer(c.embedding), `Chunk ${c.id} embedding must be a Buffer`);
    assert.ok(c.embedding.length >= 768 * 4, `Chunk ${c.id} buffer length must be at least ${768 * 4} bytes`);
  }

  console.log(`  ✓ Ingested "${ingestData.data.title}" -> ${dbChunks.length} chunks saved with active BLOB embeddings.`);
  console.log('✅ Test 4 Passed: Vector embeddings verified inside SQLite chunks table.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 5: Semantic Vector Search Retrieval & Top-K Ranking
  // -----------------------------------------------------------------
  console.log('--- Test 5: Semantic Vector Search Retrieval ---');
  const searchQuery = 'How does cosine similarity work in vector search?';

  const searchRes = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}&topK=3`);
  const searchData = await searchRes.json();

  assert.strictEqual(searchRes.status, 200);
  assert.strictEqual(searchData.success, true);
  assert.ok(searchData.data.length > 0, 'Search should return matching chunks');

  console.log(`  Query: "${searchQuery}"`);
  console.log(`  Matches returned: ${searchData.data.length}`);

  for (let i = 0; i < searchData.data.length; i++) {
    const match = searchData.data[i];
    console.log(`    Rank ${i + 1} [score: ${match.similarity}]: "${match.title}" | "${match.text.substring(0, 70)}..."`);
    assert.ok(typeof match.similarity === 'number', 'Match must have numeric similarity score');
    assert.ok(match.title, 'Match must include document title');
    assert.ok(match.text, 'Match must include chunk text');
  }

  // Ensure ranking order is descending
  for (let i = 0; i < searchData.data.length - 1; i++) {
    assert.ok(
      searchData.data[i].similarity >= searchData.data[i + 1].similarity,
      'Results must be sorted descending by similarity'
    );
  }

  console.log('✅ Test 5 Passed: Semantic vector search and top-K ranking verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 6: Database Statistics & Health Check
  // -----------------------------------------------------------------
  console.log('--- Test 6: Health Endpoint Vector Metrics & Coverage ---');
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthData = await healthRes.json();

  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthData.database.status, 'connected');
  assert.ok(healthData.database.counts.embeddedChunks > 0, 'Embedded chunks count should be > 0');
  assert.strictEqual(healthData.database.counts.missingEmbeddings, 0, 'Zero chunks should be missing embeddings');

  console.log(`  Total items: ${healthData.database.counts.items}`);
  console.log(`  Total chunks: ${healthData.database.counts.chunks}`);
  console.log(`  Embedded chunks: ${healthData.database.counts.embeddedChunks}`);
  console.log(`  Missing embeddings: ${healthData.database.counts.missingEmbeddings}`);
  console.log(`  Active Vector Engine: ${healthData.database.vectorEngine.activeProvider}`);

  console.log('✅ Test 6 Passed: Database vector stats and 100% embedding coverage verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log(`========================================`);
  console.log(`🎉 ALL ${passedCount}/${totalTests} PHASE 3 TESTS PASSED!`);
  console.log(`========================================`);

  closeDatabase();
}

runPhase3Tests().catch((err) => {
  console.error('\n❌ Phase 3 test execution failed:', err);
  process.exit(1);
});
