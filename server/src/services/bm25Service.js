/**
 * @file bm25Service.js
 * @description In-memory BM25 (Best Matching 25) lexical search engine.
 * Computes exact Okapi BM25 relevance scores for keyword and acronym queries (e.g. JVM, OOP, SSRF),
 * serving as the sparse retrieval half of our Hybrid Search RAG architecture.
 */

// BM25 Hyperparameters
const K1 = 1.2; // Term frequency saturation parameter
const B = 0.75; // Document length normalization parameter

// Standard English stop words
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
  'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenizes text into normalized lowercase alphanumeric words, filtering out short stopwords.
 * Preserves important abbreviations and technical terms.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];

  const rawTokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 0);

  const tokens = [];
  for (const token of rawTokens) {
    // Preserve acronyms even if short (e.g. 'jvm', 'oop', 'rag', 'api', 'url')
    if (token.length >= 2 && (!STOP_WORDS.has(token) || token.length <= 3)) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Computes BM25 scores for a list of document chunks given a query.
 * @param {string} query
 * @param {Array<{ id: string, text: string }>} corpus - Array of chunks to index and score.
 * @returns {Map<string, number>} Map of chunkId -> BM25 score
 */
function scoreCorpusBM25(query, corpus) {
  const queryTokens = tokenize(query);
  const scores = new Map();

  if (queryTokens.length === 0 || corpus.length === 0) {
    return scores;
  }

  const N = corpus.length;
  let totalLength = 0;
  const docTokensMap = new Map();
  const docFreqMap = new Map(); // term -> number of docs containing term

  // 1. Index document corpus
  for (const doc of corpus) {
    const tokens = tokenize(doc.text);
    docTokensMap.set(doc.id, tokens);
    totalLength += tokens.length;

    const uniqueTermsInDoc = new Set(tokens);
    for (const term of uniqueTermsInDoc) {
      docFreqMap.set(term, (docFreqMap.get(term) || 0) + 1);
    }
  }

  const avgdl = totalLength / N;

  // 2. Compute BM25 score for each document
  for (const doc of corpus) {
    const tokens = docTokensMap.get(doc.id) || [];
    const docLength = tokens.length;

    // Count term frequencies in this document
    const termFreq = new Map();
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    let score = 0.0;

    for (const qTerm of queryTokens) {
      const tf = termFreq.get(qTerm) || 0;
      if (tf === 0) continue;

      const df = docFreqMap.get(qTerm) || 0;
      // Robertson-Spärck Jones IDF formula
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

      // BM25 term weighting formula
      const numerator = tf * (K1 + 1);
      const denominator = tf + K1 * (1 - B + B * (docLength / avgdl));

      score += idf * (numerator / denominator);
    }

    if (score > 0) {
      scores.set(doc.id, score);
    }
  }

  return scores;
}

module.exports = {
  tokenize,
  scoreCorpusBM25,
};
