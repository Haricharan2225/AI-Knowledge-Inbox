/**
 * @file phase4_test.js
 * @description Comprehensive automated test suite for Phase 4: RAG Query Engine & AI Answer Generation.
 * Tests:
 * 1. Relevant Knowledge Question Answering with Source Citations.
 * 2. Irrelevant / Out-of-Context Question Rejection (Zero-Hallucination Guardrail).
 * 3. Citation Metadata Integrity (sourceNumber, title, url, chunkId, similarity, isCited).
 * 4. Input Validation (Empty / Whitespace / Malformed Payload).
 * 5. Document-Scoped Querying (Restricted via itemId filter).
 * 6. Operational Audit Logging in SQLite logs table.
 */

const assert = require('assert');
const { getDatabase, closeDatabase } = require('../config/database');

const API_BASE = 'http://localhost:5000/api';

async function runPhase4Tests() {
  console.log('🚀 Starting Phase 4: RAG Query Engine & AI Answer Generation Test Suite...\n');
  let passedCount = 0;
  const totalTests = 6;

  // First, ensure we have a fresh, predictable piece of knowledge ingested for this test run
  const testDocContent = `
Turium AI Knowledge Platform is built on an enterprise hybrid-search architecture.
It utilizes high-dimensional vector embeddings stored in SQLite to enable sub-millisecond retrieval.
Source citations are strictly enforced to eliminate hallucinations in mission-critical applications.
Security controls include real-time SSRF protection and deterministic query validation.
`.trim();

  const ingestRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'note',
      title: 'Turium AI Platform Specifications',
      content: testDocContent,
    }),
  });

  const ingestData = await ingestRes.json();
  assert.strictEqual(ingestRes.status, 201, 'Pre-test ingestion failed');
  const targetItemId = ingestData.data.id;
  console.log(`📦 Seeded knowledge item for Phase 4 testing: "${ingestData.data.title}" [${targetItemId}]\n`);

  // -----------------------------------------------------------------
  // Test 1: Relevant Question Answering with Citations
  // -----------------------------------------------------------------
  console.log('--- Test 1: Relevant Question Answering with Citations ---');
  const queryRes = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What architecture does Turium AI Platform use, and how does it prevent hallucinations?',
      topK: 4,
    }),
  });

  const queryData = await queryRes.json();
  assert.strictEqual(queryRes.status, 200, `Expected status 200, got ${queryRes.status}`);
  assert.strictEqual(queryData.success, true);
  assert.ok(queryData.data.answer.length > 20, 'Answer must have substantive length');
  assert.ok(queryData.data.sources.length > 0, 'Sources array must not be empty for relevant query');

  console.log(`  Question: "What architecture does Turium AI Platform use, and how does it prevent hallucinations?"`);
  console.log(`  Answer:\n  "${queryData.data.answer}"`);
  console.log(`  Citations provided: ${queryData.data.sources.length} sources`);
  console.log(`  Provider used: [${queryData.data.metrics.provider.toUpperCase()}] | Latency: ${queryData.data.metrics.totalDurationMs}ms`);

  // Verify that citations like [Source X] exist in the answer or sources are returned
  const hasCitationBracket = /\[Source\s+\d+\]/i.test(queryData.data.answer);
  assert.ok(hasCitationBracket, 'Answer must include at least one [Source X] citation reference');

  console.log('✅ Test 1 Passed: Relevant question answered with grounded citations.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 2: Irrelevant / Out-of-Context Question (Zero-Hallucination Guardrail)
  // -----------------------------------------------------------------
  console.log('--- Test 2: Irrelevant / Out-of-Context Question Handling ---');
  const irrelevantRes = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What is the recipe for baking chocolate sourdough croissants in France?',
      topK: 3,
      minSimilarity: 0.15, // Require meaningful similarity
    }),
  });

  const irrelevantData = await irrelevantRes.json();
  assert.strictEqual(irrelevantRes.status, 200);
  assert.strictEqual(irrelevantData.success, true);

  console.log(`  Question: "What is the recipe for baking chocolate sourdough croissants in France?"`);
  console.log(`  Response: "${irrelevantData.data.answer}"`);

  // Must cleanly decline to answer without hallucinating
  const declinedProperly =
    irrelevantData.data.answer.toLowerCase().includes('not have enough information') ||
    irrelevantData.data.answer.toLowerCase().includes('not contain') ||
    irrelevantData.data.answer.toLowerCase().includes('do not know');

  assert.ok(declinedProperly, 'AI must state that it lacks sufficient context for unrelated questions');
  console.log('✅ Test 2 Passed: Out-of-context question rejected without hallucination.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 3: Citation Metadata Integrity
  // -----------------------------------------------------------------
  console.log('--- Test 3: Citation Metadata Integrity ---');
  const firstSource = queryData.data.sources[0];

  assert.ok(typeof firstSource.sourceNumber === 'number', 'Source must have numeric sourceNumber');
  assert.ok(firstSource.chunkId, 'Source must reference a chunkId');
  assert.ok(firstSource.itemId, 'Source must reference an itemId');
  assert.ok(firstSource.title, 'Source must include the parent document title');
  assert.ok(typeof firstSource.similarity === 'number', 'Source must have a similarity score');
  assert.ok(firstSource.excerpt.length > 0, 'Source must provide a text excerpt');

  console.log(`  Source 1 verified:`);
  console.log(`    - Title: "${firstSource.title}"`);
  console.log(`    - Chunk ID: ${firstSource.chunkId}`);
  console.log(`    - Similarity Score: ${firstSource.similarity}`);
  console.log(`    - Excerpt Preview: "${firstSource.excerpt.substring(0, 80)}..."`);
  console.log('✅ Test 3 Passed: Source citation data structure fully verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 4: Input Validation (Empty & Whitespace Questions)
  // -----------------------------------------------------------------
  console.log('--- Test 4: Input Validation (Empty & Whitespace Questions) ---');

  // Case 4a: Empty string
  const emptyRes = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: '   ',
    }),
  });

  const emptyData = await emptyRes.json();
  assert.strictEqual(emptyRes.status, 400, `Expected status 400 for empty question, got ${emptyRes.status}`);
  assert.strictEqual(emptyData.success, false);
  console.log(`  ✓ Blocked empty question with HTTP 400: ${JSON.stringify(emptyData.details || emptyData.message)}`);

  // Case 4b: Missing question field
  const missingRes = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topK: 5,
    }),
  });

  const missingData = await missingRes.json();
  assert.strictEqual(missingRes.status, 400, `Expected status 400 for missing question, got ${missingRes.status}`);
  console.log(`  ✓ Blocked missing question payload with HTTP 400.`);
  console.log('✅ Test 4 Passed: Input validation enforced properly.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 5: Document-Scoped Querying (itemId Filter)
  // -----------------------------------------------------------------
  console.log('--- Test 5: Document-Scoped Querying via itemId Filter ---');
  const scopedRes = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What security controls are implemented?',
      itemId: targetItemId, // Constrain search only to the seeded document
      topK: 2,
    }),
  });

  const scopedData = await scopedRes.json();
  assert.strictEqual(scopedRes.status, 200);
  assert.ok(scopedData.data.sources.length > 0, 'Scoped search should retrieve matching chunk');

  for (const src of scopedData.data.sources) {
    assert.strictEqual(src.itemId, targetItemId, `Retrieved chunk must belong to filtered itemId ${targetItemId}`);
  }

  console.log(`  ✓ Verified all ${scopedData.data.sources.length} retrieved chunks belong strictly to document [${targetItemId}]`);
  console.log('✅ Test 5 Passed: Document-scoped query filtering verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Test 6: Operational Audit Logging in SQLite
  // -----------------------------------------------------------------
  console.log('--- Test 6: Operational Audit Logging in SQLite ---');
  const db = getDatabase();
  const latestLog = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 1').get();

  assert.ok(latestLog, 'A log entry must exist');
  assert.strictEqual(latestLog.level, 'info');
  assert.ok(latestLog.message.includes('Query answered'), 'Log message must record query answering');

  const meta = JSON.parse(latestLog.meta);
  assert.ok(meta.question, 'Log metadata must record question');
  assert.ok(meta.totalDurationMs !== undefined, 'Log metadata must record duration');

  console.log(`  ✓ Verified SQLite audit log: "${latestLog.message}"`);
  console.log(`  ✓ Metadata recorded: question="${meta.question}", duration=${meta.totalDurationMs}ms`);
  console.log('✅ Test 6 Passed: Operational audit logging verified.\n');
  passedCount++;

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log(`========================================`);
  console.log(`🎉 ALL ${passedCount}/${totalTests} PHASE 4 TESTS PASSED!`);
  console.log(`========================================`);

  closeDatabase();
}

runPhase4Tests().catch((err) => {
  console.error('\n❌ Phase 4 test execution failed:', err);
  process.exit(1);
});
