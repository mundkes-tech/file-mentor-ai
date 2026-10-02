import { DocumentModel } from "@/models/Document";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";
import { chunkingService } from "./chunking-service";
import { quoteVerificationService } from "./quote-verification-service";
import { aiService, AiChatMessage } from "./ai-service";
import {
  DocumentComparisonResult,
  ComparisonSection,
  ComparisonClauseDiff,
  VerifiedQuote,
} from "@/types";
import { DocumentChunk } from "@/types/document";

// Standard legal contract categories used for section alignment
const LEGAL_CATEGORIES: {
  category: string;
  title: string;
  keywords: string[];
}[] = [
  {
    category: "term_and_termination",
    title: "Term & Termination",
    keywords: ["termination", "terminate", "term", "convenience", "notice period", "expiration"],
  },
  {
    category: "liability",
    title: "Limitation of Liability",
    keywords: ["liability", "limitation of liability", "cap", "aggregate liability", "consequential damages", "damages"],
  },
  {
    category: "indemnification",
    title: "Indemnification & Warranties",
    keywords: ["indemnification", "indemnify", "hold harmless", "defense", "warranties", "infringement"],
  },
  {
    category: "confidentiality",
    title: "Confidentiality & Data Security",
    keywords: ["confidential", "confidentiality", "non-disclosure", "security", "soc 2", "encryption", "proprietary"],
  },
  {
    category: "payment",
    title: "Fees & Payment Terms",
    keywords: ["fee", "payment", "invoice", "net 30", "liquidated damages", "interest", "billing"],
  },
  {
    category: "intellectual_property",
    title: "Intellectual Property Ownership",
    keywords: ["intellectual property", "ip", "ownership", "work for hire", "license", "proprietary rights", "assignment"],
  },
  {
    category: "governing_law",
    title: "Governing Law & Jurisdiction",
    keywords: ["governing law", "jurisdiction", "dispute resolution", "arbitration", "venue", "courts"],
  },
  {
    category: "general",
    title: "Miscellaneous & Notices",
    keywords: ["miscellaneous", "assignment", "severability", "force majeure", "notices", "entire agreement", "amendment"],
  },
];

/**
 * Normalizes text to compare substantive content vs formatting only.
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\w\d]/g, "")
    .trim();
}

/**
 * Extracts numbers and currency terms for substantive difference checking.
 */
function extractMetrics(text: string): string[] {
  const matches = text.match(/\b(?:\$\s*[\d,]+|\d+\s*(?:days?|months?|years?|business days?|percent|%))\b/gi);
  return matches ? matches.map((m) => m.toLowerCase().replace(/\s+/g, " ").trim()) : [];
}

/**
 * Scores similarity between a chunk and a legal category based on keyword matches and heading.
 */
function scoreChunkForCategory(
  chunk: DocumentChunk,
  category: (typeof LEGAL_CATEGORIES)[0]
): number {
  let score = 0;
  const heading = (chunk.sectionHeading || "").toLowerCase();
  const text = (chunk.text || "").toLowerCase();

  for (const kw of category.keywords) {
    if (heading.includes(kw)) {
      score += 5;
    }
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(text)) {
      score += 2;
    }
  }

  return score;
}

export const comparisonService = {
  /**
   * Compares two contracts at the clause and section level using deterministic
   * alignment, substantive difference detection, and quote verification.
   */
  async compareContracts(
    baseDocId: string,
    targetDocId: string
  ): Promise<DocumentComparisonResult> {
    await connectToDatabase();

    const cleanBaseId = (baseDocId || "").trim();
    const cleanTargetId = (targetDocId || "").trim();

    if (cleanBaseId === cleanTargetId) {
      throw new Error("Cannot compare a document with itself. Please select two distinct documents.");
    }

    if (!cleanBaseId || cleanBaseId.length > 100 || !cleanTargetId || cleanTargetId.length > 100) {
      throw new Error("One or both documents selected for comparison could not be found.");
    }

    const [baseDoc, targetDoc] = await Promise.all([
      DocumentModel.findById(cleanBaseId).lean(),
      DocumentModel.findById(cleanTargetId).lean(),
    ]);

    if (!baseDoc || !targetDoc) {
      throw new Error("One or both documents selected for comparison could not be found.");
    }

    if (baseDoc.processingStatus !== "ready" || targetDoc.processingStatus !== "ready") {
      throw new Error("Both documents must be fully processed and ready before comparison.");
    }

    // 1. Ensure chunks exist for both documents
    await Promise.all([
      chunkingService.ensureChunksForDocument(cleanBaseId),
      chunkingService.ensureChunksForDocument(cleanTargetId),
    ]);

    const [baseChunks, targetChunks] = await Promise.all([
      chunkingService.getChunksForDocument(cleanBaseId),
      chunkingService.getChunksForDocument(cleanTargetId),
    ]);

    // 2. Identify corresponding sections across legal categories
    const comparisonSections: ComparisonSection[] = [];
    const legacyClauses: ComparisonClauseDiff[] = [];
    let substantiveDiffCount = 0;

    for (const cat of LEGAL_CATEGORIES) {
      // Find best chunk in baseDoc
      let bestBaseChunk: DocumentChunk | null = null;
      let maxBaseScore = 0;
      for (const chunk of baseChunks) {
        const sc = scoreChunkForCategory(chunk, cat);
        if (sc > maxBaseScore) {
          maxBaseScore = sc;
          bestBaseChunk = chunk;
        }
      }

      // Find best chunk in targetDoc
      let bestTargetChunk: DocumentChunk | null = null;
      let maxTargetScore = 0;
      for (const chunk of targetChunks) {
        const sc = scoreChunkForCategory(chunk, cat);
        if (sc > maxTargetScore) {
          maxTargetScore = sc;
          bestTargetChunk = chunk;
        }
      }

      // If neither document has substantive content for this category, skip
      if (!bestBaseChunk && !bestTargetChunk) {
        continue;
      }
      if (maxBaseScore < 2 && maxTargetScore < 2) {
        continue;
      }

      const textA = bestBaseChunk ? bestBaseChunk.text.trim() : "";
      const textB = bestTargetChunk ? bestTargetChunk.text.trim() : "";

      // 3. Substantive difference check
      let hasSubstantiveDiff = false;
      let diffType: ComparisonSection["differenceType"] = "identical";
      let diffSummary = "";

      if (!bestBaseChunk && bestTargetChunk) {
        hasSubstantiveDiff = true;
        diffType = "only_in_doc_b";
        diffSummary = `This provision is present only in "${targetDoc.name}" and has no counterpart in "${baseDoc.name}".`;
        substantiveDiffCount++;
      } else if (bestBaseChunk && !bestTargetChunk) {
        hasSubstantiveDiff = true;
        diffType = "only_in_doc_a";
        diffSummary = `This provision is present only in "${baseDoc.name}" and is not included in "${targetDoc.name}".`;
        substantiveDiffCount++;
      } else if (textA && textB) {
        const normA = normalizeForComparison(textA);
        const normB = normalizeForComparison(textB);

        if (normA === normB) {
          // Identical wording except formatting / whitespace / punctuation
          hasSubstantiveDiff = false;
          diffType = "identical";
          diffSummary = "The contractual provisions are identical in substance and legal terms.";
        } else {
          // Check for numeric / threshold differences
          const metricsA = extractMetrics(textA);
          const metricsB = extractMetrics(textB);
          const metricsDiffer =
            metricsA.length !== metricsB.length ||
            metricsA.some((m, idx) => m !== metricsB[idx]);

          if (metricsDiffer) {
            hasSubstantiveDiff = true;
            diffType = "substantive_modification";
            diffSummary = `The contracts specify differing quantitative metrics or deadlines: ${
              metricsA.length > 0 ? `[${metricsA.join(", ")}] in ${baseDoc.name}` : "None"
            } vs ${
              metricsB.length > 0 ? `[${metricsB.join(", ")}] in ${targetDoc.name}` : "None"
            }.`;
            substantiveDiffCount++;
          } else {
            // General textual modification
            hasSubstantiveDiff = true;
            diffType = "substantive_modification";
            diffSummary = `The contracts express differing obligations and scope in their ${cat.title.toLowerCase()} provisions.`;
            substantiveDiffCount++;
          }
        }
      }

      // 4. Traceable verified citations for Document A and Document B
      let citationA: VerifiedQuote | undefined;
      let citationB: VerifiedQuote | undefined;

      if (bestBaseChunk) {
        // Extract a candidate quote from the chunk (first 1-2 key sentences)
        const quoteCandidateA = this.extractSnippetForQuote(bestBaseChunk.text);
        if (quoteCandidateA) {
          const vA = await quoteVerificationService.verifyQuote(cleanBaseId, quoteCandidateA);
          if (vA.isVerified) {
            citationA = vA;
          }
        }
      }

      if (bestTargetChunk) {
        const quoteCandidateB = this.extractSnippetForQuote(bestTargetChunk.text);
        if (quoteCandidateB) {
          const vB = await quoteVerificationService.verifyQuote(cleanTargetId, quoteCandidateB);
          if (vB.isVerified) {
            citationB = vB;
          }
        }
      }

      const sectionId = `sec_${cat.category}_${Date.now()}`;
      comparisonSections.push({
        id: sectionId,
        title: cat.title,
        category: cat.category,
        documentA: {
          documentId: cleanBaseId,
          documentName: baseDoc.name,
          sectionHeading: bestBaseChunk?.sectionHeading,
          pageNumber: bestBaseChunk?.pageStart || 1,
          text: textA,
          citation: citationA,
        },
        documentB: {
          documentId: cleanTargetId,
          documentName: targetDoc.name,
          sectionHeading: bestTargetChunk?.sectionHeading,
          pageNumber: bestTargetChunk?.pageStart || 1,
          text: textB,
          citation: citationB,
        },
        hasSubstantiveDifference: hasSubstantiveDiff,
        differenceType: diffType,
        differenceSummary: diffSummary,
      });

      // Maintain legacy clause diff structure
      legacyClauses.push({
        clauseKey: cat.category,
        title: cat.title,
        docAContent: textA,
        docBContent: textB,
        status:
          diffType === "identical"
            ? "identical"
            : diffType === "only_in_doc_a"
            ? "removed"
            : diffType === "only_in_doc_b"
            ? "added"
            : "modified",
        diffSummary,
        riskChange: "unchanged",
      });
    }

    // 5. Calculate overall similarity percentage
    const totalExamined = Math.max(1, comparisonSections.length);
    const identicalCount = comparisonSections.filter((s) => !s.hasSubstantiveDifference).length;
    const overallSimilarityPercentage = Math.round((identicalCount / totalExamined) * 100);

    const summary =
      substantiveDiffCount === 0
        ? `No substantive differences detected across ${totalExamined} key contractual sections examined. Both agreements share identical terms and conditions.`
        : `Identified ${substantiveDiffCount} substantive difference(s) across ${totalExamined} contractual categories examined between "${baseDoc.name}" and "${targetDoc.name}".`;

    return {
      id: `cmp_${Date.now()}`,
      baseDocumentId: cleanBaseId,
      targetDocumentId: cleanTargetId,
      baseDocumentName: baseDoc.name,
      targetDocumentName: targetDoc.name,
      documents: [
        {
          id: cleanBaseId,
          name: baseDoc.name,
          originalFilename: baseDoc.originalFilename,
          pageCount: baseDoc.pageCount,
        },
        {
          id: cleanTargetId,
          name: targetDoc.name,
          originalFilename: targetDoc.originalFilename,
          pageCount: targetDoc.pageCount,
        },
      ],
      comparedAt: new Date().toISOString(),
      overallSimilarityPercentage,
      summary,
      sections: comparisonSections,
      clauses: legacyClauses,
    };
  },

  /**
   * Helper to extract a clean, continuous sentence or clause suitable for deterministic quote verification.
   */
  extractSnippetForQuote(text: string): string {
    if (!text) return "";
    const clean = text.replace(/[\r\n]+/g, " ").trim();
    // Match first complete sentence
    const match = clean.match(/^([^.!?]+[.!?])/);
    if (match && match[1].length >= 25 && match[1].length <= 250) {
      return match[1].trim();
    }
    // Fallback to first 120 characters at word boundary
    const slice = clean.slice(0, 120);
    const lastSpace = slice.lastIndexOf(" ");
    return lastSpace > 30 ? slice.slice(0, lastSpace).trim() : slice.trim();
  },
};
