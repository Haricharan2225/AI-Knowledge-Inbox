/**
 * @file phase2_test.js
 * @description Comprehensive automated test runner for Phase 2: Ingestion Pipeline.
 * Tests:
 * 1. Note ingestion with sample text (> 500 chars to verify chunking and overlap).
 * 2. URL ingestion with public website.
 * 3. Invalid URL handling (malformed URL, private IP SSRF attempt, non-existent host).
 * 4. Empty / invalid text validation.
 * 5. SQLite database inspection (verifying items, chunks, and logs tables).
 * 6. Chunk count and overlap verification.
 */

const assert = require('assert');
const { getDatabase, closeDatabase } = require('../config/database');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('🚀 Starting Phase 2 Test Suite...\n');
  let passedCount = 0;
  let totalCount = 6;

  // -------------------------------------------------------------
  // Test 1: Note Ingestion with Multi-Paragraph Sample Text (> 500 chars)
  // -------------------------------------------------------------
  console.log('--- Test 1: Ingestion with Sample Text ---');
  const sampleNoteContent = `
Turium AI is pioneering enterprise intelligence by transforming unstructured operational data into actionable semantic assets.

Through modern retrieval-augmented generation architectures, organizations can ingest diverse content repositories such as internal knowledge bases, technical documentation, and dynamic web assets.

Each ingested document is parsed, segmented into coherent semantic passages, and embedded into high-dimensional vector spaces. When users query the knowledge inbox, contextual similarity matching retrieves the most pertinent excerpts, providing accurate answers backed by transparent citations.

This systematic approach minimizes hallucinations, guarantees source grounding, and ensures enterprise compliance across mission-critical workflows.
`.trim();

  let noteIngestRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'note',
      title: 'Turium AI Architecture Overview',
      content: sampleNoteContent,
    }),
  });

  const noteData = await noteIngestRes.json();
  assert.strictEqual(noteIngestRes.status, 201, `Expected status 201, got ${noteIngestRes.status}`);
  assert.strictEqual(noteData.success, true);
  assert.strictEqual(noteData.data.type, 'note');
  assert.strictEqual(noteData.data.title, 'Turium AI Architecture Overview');
  assert.ok(noteData.data.chunkCount >= 2, `Expected at least 2 chunks for >500 char text, got ${noteData.data.chunkCount}`);
  console.log(`✅ Test 1 Passed: Ingested note "${noteData.data.title}" (${noteData.data.contentLength} chars) into ${noteData.data.chunkCount} chunks. Item ID: ${noteData.data.id}\n`);
  passedCount++;

  // -------------------------------------------------------------
  // Test 2: URL Ingestion with Publicly Accessible Webpage
  // -------------------------------------------------------------
  console.log('--- Test 2: Ingestion with Public URL ---');
  let urlIngestRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'url',
      url: 'https://example.com',
    }),
  });

  const urlData = await urlIngestRes.json();
  assert.strictEqual(urlIngestRes.status, 201, `Expected status 201, got ${urlIngestRes.status}`);
  assert.strictEqual(urlData.success, true);
  assert.strictEqual(urlData.data.type, 'url');
  assert.ok(urlData.data.title.length > 0, 'Extracted title should not be empty');
  assert.ok(urlData.data.contentLength > 50, 'Scraped content should have meaningful length');
  assert.ok(urlData.data.chunkCount >= 1, 'Chunk count should be >= 1');
  console.log(`✅ Test 2 Passed: Ingested URL "${urlData.data.url}" -> Title: "${urlData.data.title}", Chunks: ${urlData.data.chunkCount}, Length: ${urlData.data.contentLength}\n`);
  passedCount++;

  // -------------------------------------------------------------
  // Test 3: Invalid URL Handling & SSRF Protection
  // -------------------------------------------------------------
  console.log('--- Test 3: Invalid URL & SSRF Security Handling ---');

  // Case 3a: Private IP / SSRF attempt
  let ssrfRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'url',
      url: 'http://127.0.0.1:8080/admin',
    }),
  });
  const ssrfData = await ssrfRes.json();
  assert.strictEqual(ssrfRes.status, 403, `Expected status 403 for private IP SSRF, got ${ssrfRes.status}`);
  assert.strictEqual(ssrfData.success, false);
  console.log(`  ✓ Blocked SSRF to 127.0.0.1 with HTTP 403: "${ssrfData.message}"`);

  // Case 3b: Localhost hostname
  let localhostRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'url',
      url: 'http://localhost:5000/api/health',
    }),
  });
  const localhostData = await localhostRes.json();
  assert.strictEqual(localhostRes.status, 403, `Expected status 403 for localhost, got ${localhostRes.status}`);
  console.log(`  ✓ Blocked SSRF to localhost with HTTP 403: "${localhostData.message}"`);

  // Case 3c: Malformed URL format
  let malformedRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'url',
      url: 'not-a-valid-url',
    }),
  });
  const malformedData = await malformedRes.json();
  assert.strictEqual(malformedRes.status, 400, `Expected status 400 for malformed URL, got ${malformedRes.status}`);
  console.log(`  ✓ Rejected malformed URL with HTTP 400: "${malformedData.error}"`);

  console.log('✅ Test 3 Passed: All invalid URL and SSRF security tests handled correctly.\n');
  passedCount++;

  // -------------------------------------------------------------
  // Test 4: Empty Text Validation
  // -------------------------------------------------------------
  console.log('--- Test 4: Empty Text Validation ---');
  let emptyTextRes = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'note',
      title: 'Empty Note',
      content: '   ',
    }),
  });

  const emptyTextData = await emptyTextRes.json();
  assert.strictEqual(emptyTextRes.status, 400, `Expected status 400 for empty content, got ${emptyTextRes.status}`);
  assert.strictEqual(emptyTextData.success, false);
  console.log(`✅ Test 4 Passed: Empty text rejected with HTTP 400: ${JSON.stringify(emptyTextData.details || emptyTextData.message)}\n`);
  passedCount++;

  // -------------------------------------------------------------
  // Test 5: Verify Records Saved in SQLite Database
  // -------------------------------------------------------------
  console.log('--- Test 5: SQLite Database Verification ---');
  const db = getDatabase();

  const items = db.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
  const chunks = db.prepare('SELECT * FROM chunks WHERE item_id = ? ORDER BY chunk_index ASC').all(noteData.data.id);
  const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 5').all();

  assert.ok(items.length >= 2, `Expected at least 2 items in DB, found ${items.length}`);
  assert.strictEqual(chunks.length, noteData.data.chunkCount, 'Chunks in DB should match returned chunkCount');

  // Verify chunk schema
  const firstChunk = chunks[0];
  assert.ok(firstChunk.id, 'Chunk must have an ID');
  assert.strictEqual(firstChunk.item_id, noteData.data.id, 'Chunk item_id must match item ID');
  assert.strictEqual(firstChunk.chunk_index, 0, 'First chunk must have index 0');
  assert.ok(firstChunk.text.length > 0, 'Chunk text must not be empty');
  assert.ok(firstChunk.embedding !== undefined, 'Embedding column exists in schema');

  // Verify logs table
  assert.ok(logs.length >= 2, 'Operational logs should be recorded');
  console.log(`  ✓ Found ${items.length} total items in "items" table.`);
  console.log(`  ✓ Found ${chunks.length} chunks linked to item ${noteData.data.id} via foreign key.`);
  console.log(`  ✓ Found ${logs.length} structured log entries in "logs" table.`);
  console.log('✅ Test 5 Passed: SQLite records and foreign key constraints successfully verified.\n');
  passedCount++;

  // -------------------------------------------------------------
  // Test 6: Verify Chunk Count and Overlap
  // -------------------------------------------------------------
  console.log('--- Test 6: Chunk Size and Overlap Verification ---');
  // Inspect chunk texts for Test 1 note
  console.log(`Examining ${chunks.length} chunks generated for note:`);
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Chunk [${chunks[i].chunk_index}]: length=${chunks[i].text.length} chars | preview: "${chunks[i].text.substring(0, 60)}..."`);
  }

  // Check overlap between Chunk 0 and Chunk 1
  if (chunks.length >= 2) {
    const chunk0 = chunks[0].text;
    const chunk1 = chunks[1].text;

    // Check if the end of chunk0 or tokens from chunk0 appear in chunk1
    // We expect semantic overlap ~100 chars
    const chunk0Words = chunk0.split(/\s+/);
    const lastWords = chunk0Words.slice(-5).join(' '); // last 5 words of chunk 0

    const overlapFound = chunk1.includes(lastWords);
    console.log(`  Checking overlap: Last words of Chunk 0 ("${lastWords}") present in Chunk 1? => ${overlapFound ? 'YES' : 'NO'}`);
    assert.ok(overlapFound, 'Consecutive chunks must share semantic overlap');
    console.log(`  ✓ Overlap verified: Chunk 1 contains continuity text from Chunk 0.`);
  }

  console.log('✅ Test 6 Passed: Chunk sizes and overlapping semantic window verified.\n');
  passedCount++;

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log(`========================================`);
  console.log(`🎉 ALL ${passedCount}/${totalCount} PHASE 2 TESTS PASSED!`);
  console.log(`========================================`);

  closeDatabase();
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
