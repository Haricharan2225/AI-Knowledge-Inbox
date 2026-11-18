/**
 * @file chunkingService.js
 * @description Semantic text segmenter with sentence-preserving sliding window.
 * Splits text documents into approximately 500-character passages with ~100-character overlap,
 * avoiding mid-sentence cuts to optimize retrieval accuracy in RAG.
 */

const logger = require('../config/logger');

const DEFAULT_TARGET_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP_SIZE = 100;

/**
 * Splits text into atomic semantic blocks (paragraphs and sentences).
 * Ensures sentences are kept intact unless an individual sentence exceeds target size.
 * @param {string} text
 * @param {number} maxUnitSize
 * @returns {string[]} Array of semantic text tokens.
 */
function splitIntoSemanticUnits(text, maxUnitSize) {
  // First break on paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const units = [];

  for (const para of paragraphs) {
    // If the paragraph fits comfortably, keep it as a unit
    if (para.length <= maxUnitSize) {
      units.push(para);
      continue;
    }

    // Otherwise split the paragraph into sentences using punctuation boundaries
    const sentences = para.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

    for (const sentence of sentences) {
      if (sentence.length <= maxUnitSize) {
        units.push(sentence);
      } else {
        // If an individual sentence is extraordinarily long, split on words
        const words = sentence.split(/\s+/).filter((w) => w.length > 0);
        let currentWordBlock = '';

        for (const word of words) {
          if ((currentWordBlock + ' ' + word).trim().length <= maxUnitSize) {
            currentWordBlock = (currentWordBlock + ' ' + word).trim();
          } else {
            if (currentWordBlock) units.push(currentWordBlock);
            // If single word itself exceeds maxUnitSize, hard slice it
            if (word.length > maxUnitSize) {
              for (let i = 0; i < word.length; i += maxUnitSize) {
                units.push(word.slice(i, i + maxUnitSize));
              }
              currentWordBlock = '';
            } else {
              currentWordBlock = word;
            }
          }
        }
        if (currentWordBlock) units.push(currentWordBlock);
      }
    }
  }

  return units;
}

/**
 * Splits raw text into structured chunks of approximately targetChunkSize with overlapSize.
 * @param {string} text - Raw text to split.
 * @param {object} [options]
 * @param {number} [options.targetChunkSize=500] - Approximate size of each chunk.
 * @param {number} [options.overlapSize=100] - Overlap window size between consecutive chunks.
 * @returns {Array<{ chunkIndex: number, text: string, characterCount: number }>}
 */
function chunkText(text, options = {}) {
  const targetChunkSize = options.targetChunkSize || DEFAULT_TARGET_CHUNK_SIZE;
  const overlapSize = options.overlapSize || DEFAULT_OVERLAP_SIZE;

  if (typeof text !== 'string') {
    throw new TypeError('chunkText expects text to be a string.');
  }

  const cleanedText = text.trim();
  if (!cleanedText) {
    const error = new Error('Cannot chunk empty text.');
    error.statusCode = 400;
    throw error;
  }

  // Fast path: Text is smaller than or equal to target chunk size
  if (cleanedText.length <= targetChunkSize) {
    return [
      {
        chunkIndex: 0,
        text: cleanedText,
        characterCount: cleanedText.length,
      },
    ];
  }

  // Decompose text into atomic semantic units (sentences/paragraphs)
  const units = splitIntoSemanticUnits(cleanedText, targetChunkSize);
  const chunks = [];
  let unitIndex = 0;

  while (unitIndex < units.length) {
    let currentChunkUnits = [];
    let currentLength = 0;
    let startUnit = unitIndex;

    // Accumulate units until we reach or slightly exceed targetChunkSize
    while (unitIndex < units.length) {
      const nextUnit = units[unitIndex];
      const addition = currentLength === 0 ? nextUnit.length : nextUnit.length + 1; // +1 for space

      if (currentLength + addition > targetChunkSize && currentChunkUnits.length > 0) {
        break;
      }

      currentChunkUnits.push(nextUnit);
      currentLength += addition;
      unitIndex++;
    }

    const chunkContent = currentChunkUnits.join(' ').trim();
    if (chunkContent.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        text: chunkContent,
        characterCount: chunkContent.length,
      });
    }

    // If we've consumed all units, stop
    if (unitIndex >= units.length) {
      break;
    }

    // Calculate overlap: Step unitIndex backwards so the next chunk includes ~overlapSize characters
    let overlapCount = 0;
    let backtrackIndex = unitIndex - 1;

    while (backtrackIndex > startUnit) {
      const unitLen = units[backtrackIndex].length + 1;
      if (overlapCount + unitLen > overlapSize && overlapCount > 0) {
        break;
      }
      overlapCount += unitLen;
      backtrackIndex--;
    }

    // Ensure forward progress: the new starting index must be strictly greater than startUnit
    unitIndex = Math.max(startUnit + 1, backtrackIndex + 1);
  }

  logger.info(`📄 Text partitioned into ${chunks.length} chunks (target: ${targetChunkSize}, overlap: ${overlapSize})`);

  return chunks;
}

module.exports = {
  chunkText,
  splitIntoSemanticUnits,
  DEFAULT_TARGET_CHUNK_SIZE,
  DEFAULT_OVERLAP_SIZE,
};
