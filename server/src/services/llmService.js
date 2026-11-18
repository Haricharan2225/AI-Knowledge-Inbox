/**
 * @file llmService.js
 * @description Provider-agnostic LLM completion engine for AI Knowledge Inbox.
 * Supports:
 * 1. Google Gemini (gemini-1.5-flash)
 * 2. OpenAI (gpt-4o-mini)
 * 3. Grounded Context Synthesizer (offline / fallback engine)
 * 
 * Enforces strict grounding: Answers must only be derived from provided context chunks,
 * with explicit [Source X] citations. Never hallucinates when context is absent.
 */

const env = require('../config/env');
const logger = require('../config/logger');

/**
 * System prompt that enforces strict grounding and source citation rules.
 */
const SYSTEM_INSTRUCTION = `You are the AI Knowledge Assistant for the AI Knowledge Inbox.
Your goal is to answer the user's question accurately and concisely, STRICTLY based on the provided context excerpts.

Rules:
1. ONLY answer using facts directly mentioned in the provided Context Excerpts.
2. For EVERY factual claim, cite the source using the exact format [Source X], where X is the source number.
3. If the provided context excerpts do not contain enough information to answer the question truthfully, you MUST state: "I do not have enough information in the saved knowledge to answer this question."
4. Do NOT speculate, assume, or use external knowledge not present in the excerpts.
5. Keep your tone objective, professional, and clear.`;

/**
 * Generates an answer using Google Gemini API.
 * @param {string} question
 * @param {string} contextBlock
 * @returns {Promise<string>}
 */
async function generateGeminiCompletion(question, contextBlock) {
  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const prompt = `${SYSTEM_INSTRUCTION}

=== CONTEXT EXCERPTS ===
${contextBlock}

=== USER QUESTION ===
${question}

=== GROUNDED ANSWER ===`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1, // Low temperature for deterministic, factual output
        maxOutputTokens: 800,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) {
    throw new Error('Gemini API returned an empty completion.');
  }

  return answer.trim();
}

/**
 * Generates an answer using OpenAI API.
 * @param {string} question
 * @param {string} contextBlock
 * @returns {Promise<string>}
 */
async function generateOpenAICompletion(question, contextBlock) {
  const model = 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const userContent = `=== CONTEXT EXCERPTS ===
${contextBlock}

=== USER QUESTION ===
${question}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) {
    throw new Error('OpenAI API returned an empty completion.');
  }

  return answer.trim();
}

// Domain-specific technical synonym and acronym mappings for precise lexical grounding
const CONCEPT_SYNONYMS = {
  'oop': ['object-oriented', 'inheritance', 'polymorphism', 'encapsulation', 'abstraction', 'principles', 'classes'],
  'principles': ['inheritance', 'polymorphism', 'encapsulation', 'abstraction', 'oop', 'object-oriented'],
  'jvm': ['java virtual machine', 'bytecode', 'platforms', 'platform', 'runtime'],
  'exception': ['exceptions', 'try', 'catch', 'finally', 'throw', 'throws', 'handling'],
  'keywords': ['try', 'catch', 'finally', 'throw', 'throws', 'syntax'],
  'cosine': ['vector', 'similarity', 'angle', 'dot product', 'embeddings'],
  'architecture': ['hybrid-search', 'retrieval-augmented', 'rag', 'sqlite', 'platform'],
  'security': ['ssrf', 'private ip', 'localhost', 'validation', 'protection'],
  'quantum': ['qubit', 'superposition', 'quantum computing']
};

/**
 * Offline / Fallback Grounded Synthesizer.
 * Extracts relevant sentences matching question keywords from context chunks and cites them.
 * Supports compound questions, concept expansion, and sentence context chaining.
 * If question keywords have no meaningful match in the chunks, explicitly declares insufficient context.
 * @param {string} question
 * @param {Array<{ sourceNumber: number, title: string, text: string, similarity: number }>} contextChunks
 * @returns {string}
 */
function generateDeterministicAnswer(question, contextChunks) {
  if (!contextChunks || contextChunks.length === 0) {
    return 'I do not have enough information in the saved knowledge to answer this question.';
  }

  // Tokenize question to identify key terms (ignoring common stop words)
  const stopWords = new Set([
    'what', 'is', 'the', 'how', 'does', 'do', 'are', 'in', 'of', 'and', 'to',
    'a', 'an', 'for', 'with', 'on', 'at', 'by', 'from', 'this', 'that', 'it',
    'tell', 'me', 'about', 'can', 'you', 'explain', 'why', 'which'
  ]);

  // Check if query is a compound / multi-concept question (e.g. multiple question marks)
  const subQuestions = question
    .split(/(?<=\?)\s+/)
    .map((q) => q.trim())
    .filter((q) => q.length > 5);

  const isCompound = subQuestions.length > 1;

  /**
   * Helper to answer an individual atomic question using context chunks.
   */
  function answerAtomicQuery(queryStr) {
    const rawTerms = queryStr
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));

    if (rawTerms.length === 0) return null;

    // Expand query terms with concept synonyms
    const expandedTerms = new Set(rawTerms);
    for (const term of rawTerms) {
      if (CONCEPT_SYNONYMS[term]) {
        for (const syn of CONCEPT_SYNONYMS[term]) {
          expandedTerms.add(syn);
        }
      }
    }

    const matchedBlocks = [];

    for (const chunk of contextChunks) {
      // Split into clean sentence units
      const rawSentences = chunk.text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (let i = 0; i < rawSentences.length; i++) {
        const sentence = rawSentences[i];
        const sentenceLower = sentence.toLowerCase();
        let matchScore = 0;

        for (const term of expandedTerms) {
          if (sentenceLower.includes(term)) {
            matchScore += term.length > 3 ? 2 : 1;
          }
        }

        if (matchScore > 0) {
          let combinedSentence = sentence;

          // Context Window Chaining:
          // If this sentence matches a core concept, and the immediately following sentence provides
          // elaboration (e.g. starts with "It supports", "The JVM", "These include"), chain them together!
          if (i + 1 < rawSentences.length) {
            const nextSentence = rawSentences[i + 1];
            const nextLower = nextSentence.toLowerCase();
            const isContinuation =
              nextLower.startsWith('it supports') ||
              nextLower.startsWith('the jvm') ||
              nextLower.startsWith('this allows') ||
              nextLower.startsWith('these include') ||
              nextLower.startsWith('it utilizes') ||
              nextLower.startsWith('source citations');

            if (isContinuation) {
              combinedSentence = `${sentence} ${nextSentence}`;
              matchScore += 2;
            }
          }

          matchedBlocks.push({
            text: combinedSentence,
            sourceNumber: chunk.sourceNumber,
            score: matchScore + chunk.similarity * 3,
          });
        }
      }
    }

    if (matchedBlocks.length === 0) return null;

    // Sort by relevance score
    matchedBlocks.sort((a, b) => b.score - a.score);
    const topMatch = matchedBlocks[0];

    return {
      text: topMatch.text,
      sourceNumber: topMatch.sourceNumber,
    };
  }

  // 1. If it's a compound question with multiple distinct inquiries
  if (isCompound) {
    const sectionAnswers = [];
    let supportedCount = 0;

    for (const subQ of subQuestions) {
      const match = answerAtomicQuery(subQ);
      if (match) {
        sectionAnswers.push(`${match.text} [Source ${match.sourceNumber}]`);
        supportedCount++;
      } else {
        const shortQ = subQ.replace(/\?+$/, '');
        sectionAnswers.push(`Information regarding "${shortQ}" was not found in the saved knowledge.`);
      }
    }

    if (supportedCount === 0) {
      return 'I do not have enough information in the saved knowledge to answer this question.';
    }

    return sectionAnswers.join(' ');
  }

  // 2. Single question processing
  const singleMatch = answerAtomicQuery(question);
  if (!singleMatch) {
    return 'I do not have enough information in the saved knowledge to answer this question.';
  }

  // Also check if there is a secondary complementary claim
  const allTerms = question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  const secondaryMatch = answerAtomicQuery(allTerms.slice(1).join(' '));

  if (secondaryMatch && secondaryMatch.text !== singleMatch.text) {
    return `${singleMatch.text} [Source ${singleMatch.sourceNumber}] ${secondaryMatch.text} [Source ${secondaryMatch.sourceNumber}]`;
  }

  return `${singleMatch.text} [Source ${singleMatch.sourceNumber}]`;
}

/**
 * Primary dispatch function for answer generation.
 * @param {object} params
 * @param {string} params.question
 * @param {Array<{ sourceNumber: number, title: string, text: string, similarity: number }>} params.contextChunks
 * @returns {Promise<{ answer: string, provider: string }>}
 */
async function generateAnswer({ question, contextChunks }) {
  // If no chunks provided, reject immediately
  if (!contextChunks || contextChunks.length === 0) {
    return {
      answer: 'I do not have enough information in the saved knowledge to answer this question.',
      provider: 'guardrail',
    };
  }

  // Construct formatted context block for LLM
  const contextBlock = contextChunks
    .map(
      (c) =>
        `[Source ${c.sourceNumber}] (Document: "${c.title}"${c.url ? `, URL: ${c.url}` : ''})\n${c.text}`
    )
    .join('\n\n');

  // Determine active provider
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0) {
    try {
      logger.info('🤖 Generating answer using Google Gemini (gemini-1.5-flash)...');
      const answer = await generateGeminiCompletion(question, contextBlock);
      return { answer, provider: 'gemini' };
    } catch (err) {
      logger.warn(`Gemini LLM generation failed (${err.message}). Falling back to deterministic synthesizer.`);
    }
  }

  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0) {
    try {
      logger.info('🤖 Generating answer using OpenAI (gpt-4o-mini)...');
      const answer = await generateOpenAICompletion(question, contextBlock);
      return { answer, provider: 'openai' };
    } catch (err) {
      logger.warn(`OpenAI LLM generation failed (${err.message}). Falling back to deterministic synthesizer.`);
    }
  }

  // Deterministic Grounded Engine
  logger.info('🤖 Generating grounded answer using Deterministic Synthesizer...');
  const answer = generateDeterministicAnswer(question, contextChunks);
  return { answer, provider: 'deterministic' };
}

module.exports = {
  generateAnswer,
  generateDeterministicAnswer,
  SYSTEM_INSTRUCTION,
};
