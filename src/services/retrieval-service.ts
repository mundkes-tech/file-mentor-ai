import { DocumentChunk } from "@/types";
import { DocumentChunkModel, IDocumentChunk } from "@/models/DocumentChunk";
import { connectToDatabase } from "@/lib/mongodb";
import { RETRIEVAL_CONFIG } from "@/lib/constants";
import { chunkingService } from "./chunking-service";

export interface ScoreBreakdown {
  bm25: number;
  phraseBonus: number;
  headingBonus: number;
  coverageBonus: number;
  proximityBonus: number;
}

export interface RetrievedChunk extends DocumentChunk {
  score: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface RetrievalOptions {
  topK?: number;
  minScore?: number;
  includeBreakdown?: boolean;
}

export interface RetrievalResult {
  documentId: string;
  query: string;
  totalChunksInDocument: number;
  retrievedChunks: RetrievedChunk[];
  maxScore: number;
  strategy: "lexical";
}

/**
 * Standard stop words for English legal queries.
 */
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
  "hasn't", "have", "haven't", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
  "it's", "its", "itself", "me", "more", "most", "must", "my", "myself", "no",
  "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
  "ours", "ourselves", "out", "over", "own", "same", "she", "should", "shouldn't",
  "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "this", "those", "through", "to",
  "too", "under", "until", "up", "very", "was", "wasn't", "we", "were", "weren't",
  "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would",
  "wouldn't", "you", "your", "yours", "yourself", "yourselves", "shall", "may",
  "pursuant", "hereto", "herein", "thereof", "therein"
]);

/**
 * Normalizes text for lexical search: lowercases and removes non-alphanumeric characters.
 */
function cleanToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Basic legal-aware suffix trimmer for morphological matching (e.g. termination -> terminat).
 */
function stemToken(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith("ation")) return word.slice(0, -5);
  if (word.endsWith("tions") || word.endsWith("ments")) return word.slice(0, -5);
  if (word.endsWith("tion") || word.endsWith("ment")) return word.slice(0, -4);
  if (word.endsWith("able") || word.endsWith("ible")) return word.slice(0, -4);
  if (word.endsWith("ing")) return word.slice(0, -3);
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ied")) return word.slice(0, -3) + "y";
  if (word.endsWith("ed")) return word.slice(0, -2);
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * Extracts searchable keywords and legal stems from user question.
 */
export function extractQueryKeywords(query: string): {
  terms: string[];
  stems: string[];
  bigrams: string[];
  fullPhrase: string;
} {
  const rawWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const filteredWords = rawWords.filter((w) => !STOP_WORDS.has(w) && w.length > 1);
  const terms = Array.from(new Set(filteredWords));
  const stems = Array.from(new Set(terms.map(stemToken)));

  // Generate adjacent bigrams (e.g., "termination notice", "notice period")
  const bigrams: string[] = [];
  for (let i = 0; i < filteredWords.length - 1; i++) {
    bigrams.push(`${filteredWords[i]} ${filteredWords[i + 1]}`);
  }

  const fullPhrase = filteredWords.join(" ");

  return { terms, stems, bigrams, fullPhrase };
}

/**
 * Deterministic Lexical Retrieval Engine using BM25, phrase matching, heading relevance,
 * and term coverage.
 */
export class LexicalRetrievalEngine {
  /**
   * Scores and ranks document chunks based on deterministic lexical relevance.
   */
  rank(
    chunks: IDocumentChunk[],
    query: string,
    options: RetrievalOptions = {}
  ): RetrievedChunk[] {
    if (!chunks || chunks.length === 0 || !query || !query.trim()) {
      return [];
    }

    const { terms, stems, bigrams, fullPhrase } = extractQueryKeywords(query);

    // If query contains no meaningful keywords, return empty
    if (terms.length === 0) {
      return [];
    }

    const N = chunks.length;
    let totalLength = 0;
    const chunkStats: {
      lowerText: string;
      tokens: string[];
      stems: string[];
      tokenCounts: Map<string, number>;
      stemCounts: Map<string, number>;
    }[] = [];

    // Precompute token frequencies for each chunk
    for (const chunk of chunks) {
      const lowerText = chunk.text.toLowerCase();
      totalLength += chunk.text.length;

      const words = lowerText
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1);

      const tokenCounts = new Map<string, number>();
      const stemCounts = new Map<string, number>();

      for (const w of words) {
        tokenCounts.set(w, (tokenCounts.get(w) || 0) + 1);
        const s = stemToken(w);
        stemCounts.set(s, (stemCounts.get(s) || 0) + 1);
      }

      chunkStats.push({
        lowerText,
        tokens: words,
        stems: Array.from(stemCounts.keys()),
        tokenCounts,
        stemCounts,
      });
    }

    const avgLength = totalLength / N || 1;

    // Calculate Document Frequency (DF) and Inverse Document Frequency (IDF) for each query term
    const idfMap = new Map<string, number>();
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const stem = stems[i];

      let df = 0;
      for (const stat of chunkStats) {
        if (stat.tokenCounts.has(term) || stat.stemCounts.has(stem)) {
          df++;
        }
      }

      // Standard Lucene/BM25 IDF formula
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      idfMap.set(term, Math.max(0.1, idf));
    }

    // Parameters for BM25
    const k1 = 1.2;
    const b = 0.75;

    const scoredChunks: RetrievedChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const stat = chunkStats[i];
      const chunkLen = chunk.text.length;
      const lenNorm = 1 - b + b * (chunkLen / avgLength);

      let bm25Score = 0;
      let matchedUniqueTerms = 0;

      // 1. BM25 Term Matching
      for (let t = 0; t < terms.length; t++) {
        const term = terms[t];
        const stem = stems[t];

        const exactCount = stat.tokenCounts.get(term) || 0;
        const stemCount = stat.stemCounts.get(stem) || 0;
        const tf = Math.max(exactCount, stemCount * 0.9);

        if (tf > 0) {
          matchedUniqueTerms++;
          const idf = idfMap.get(term) || 0.1;
          const termScore = idf * ((tf * (k1 + 1)) / (tf + k1 * lenNorm));
          bm25Score += termScore;
        }
      }

      // If no terms matched at all, continue with zero score
      if (matchedUniqueTerms === 0) {
        continue;
      }

      // 2. Exact Multi-word Phrase Matching Bonus
      let phraseBonus = 0;
      if (fullPhrase.length > 5 && stat.lowerText.includes(fullPhrase)) {
        phraseBonus += 5.0; // Exact match of all keywords in sequence
      }

      for (const bigram of bigrams) {
        if (stat.lowerText.includes(bigram)) {
          phraseBonus += 2.0;
        }
      }

      // 3. Section / Heading Relevance Bonus
      let headingBonus = 0;
      const headingCandidate = (
        (chunk.sectionHeading || "") +
        " " +
        chunk.text.slice(0, 120)
      ).toLowerCase();

      for (let t = 0; t < terms.length; t++) {
        const term = terms[t];
        const stem = stems[t];
        if (headingCandidate.includes(term) || headingCandidate.includes(stem)) {
          headingBonus += 3.5;
          break; // Award once per matching heading
        }
      }

      // 4. Term Coverage Bonus (proportional to how many query keywords appear)
      const coverageRatio = matchedUniqueTerms / terms.length;
      const coverageBonus = coverageRatio * 3.0;

      // 5. Term Proximity Bonus (when multiple terms appear close to each other)
      let proximityBonus = 0;
      if (matchedUniqueTerms >= 2 && terms.length >= 2) {
        // Find indices of matched terms in lowerText
        const termIndices: number[] = [];
        for (const term of terms) {
          const idx = stat.lowerText.indexOf(term);
          if (idx !== -1) termIndices.push(idx);
        }

        if (termIndices.length >= 2) {
          termIndices.sort((a, b) => a - b);
          const span = termIndices[termIndices.length - 1] - termIndices[0];
          if (span < 150) {
            proximityBonus = 2.0;
          } else if (span < 350) {
            proximityBonus = 1.0;
          }
        }
      }

      const totalScore =
        bm25Score + phraseBonus + headingBonus + coverageBonus + proximityBonus;

      scoredChunks.push({
        id: chunk._id,
        chunkId: chunk._id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        pageNumber: chunk.pageStart,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        sectionHeading: chunk.sectionHeading,
        tokenCount: chunk.tokenCount,
        score: Math.round(totalScore * 100) / 100,
        scoreBreakdown: options.includeBreakdown
          ? {
              bm25: Math.round(bm25Score * 100) / 100,
              phraseBonus,
              headingBonus,
              coverageBonus: Math.round(coverageBonus * 100) / 100,
              proximityBonus,
            }
          : undefined,
      });
    }

    // Sort descending by score, deterministic tie-breaking by chunkIndex ascending
    scoredChunks.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.chunkIndex - b.chunkIndex;
    });

    const topK = options.topK ?? RETRIEVAL_CONFIG.topK;
    const minScore = options.minScore ?? RETRIEVAL_CONFIG.minRelevanceScore;

    return scoredChunks.filter((c) => c.score >= minScore).slice(0, topK);
  }
}

const defaultLexicalEngine = new LexicalRetrievalEngine();

export const retrievalService = {
  /**
   * Retrieves the most relevant chunks strictly belonging to the requested document.
   * Guarantees absolute document isolation (NEVER returns chunks from any other document).
   */
  async retrieveRelevantChunks(
    documentId: string,
    question: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    if (!documentId || !documentId.trim()) {
      throw new Error("documentId is required for chunk retrieval.");
    }

    await connectToDatabase();
    const cleanDocId = documentId.trim();

    // 1. Ensure chunks exist in MongoDB for this document (lazy generation if needed)
    await chunkingService.ensureChunksForDocument(cleanDocId);

    // 2. Fetch chunks strictly filtered by documentId
    const rawChunks = await DocumentChunkModel.find({ documentId: cleanDocId })
      .sort({ chunkIndex: 1 })
      .lean();

    const totalChunksInDocument = rawChunks.length;

    if (totalChunksInDocument === 0) {
      return {
        documentId: cleanDocId,
        query: question,
        totalChunksInDocument: 0,
        retrievedChunks: [],
        maxScore: 0,
        strategy: "lexical",
      };
    }

    // 3. Rank chunks deterministically using LexicalRetrievalEngine
    const retrievedChunks = defaultLexicalEngine.rank(rawChunks, question, options);
    const maxScore = retrievedChunks.length > 0 ? retrievedChunks[0].score : 0;

    // Optional development debug logging
    if (process.env.NODE_ENV === "development" || process.env.DEBUG_RETRIEVAL === "true") {
      console.log(
        `[RetrievalService] Doc: ${cleanDocId} | Total: ${totalChunksInDocument} | Retrieved: ${retrievedChunks.length} | MaxScore: ${maxScore} | Query: "${question}"`
      );
    }

    return {
      documentId: cleanDocId,
      query: question,
      totalChunksInDocument,
      retrievedChunks,
      maxScore,
      strategy: "lexical",
    };
  },
};
