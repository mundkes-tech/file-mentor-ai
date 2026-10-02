import { documentService } from "./document-service";
import { DocumentPage, QuoteMatchLocation, VerifiedQuote } from "@/types";

/**
 * Result of building a normalized character index.
 * Maps every character in normalizedText back to its original character offset in rawText.
 */
interface NormalizedIndex {
  normalizedText: string;
  normToOrigMap: number[];
}

/**
 * Builds a normalized version of text while maintaining an exact 1-to-1 index mapping
 * from every character in normalizedText to its original byte/char offset in rawText.
 */
export function buildNormalizedIndex(rawText: string): NormalizedIndex {
  if (!rawText) {
    return { normalizedText: "", normToOrigMap: [] };
  }

  let normalizedText = "";
  const normToOrigMap: number[] = [];

  let i = 0;
  const len = rawText.length;

  while (i < len) {
    const ch = rawText[i];

    // Check for whitespace sequence: \s, \r, \n, \t, non-breaking space, zero-width space
    if (/[\s\u00A0\u2000-\u200B\uFEFF]/.test(ch)) {
      const whitespaceStart = i;
      while (i < len && /[\s\u00A0\u2000-\u200B\uFEFF]/.test(rawText[i])) {
        i++;
      }
      // Collapse whitespace to a single space, but omit leading space
      if (normalizedText.length > 0) {
        normalizedText += " ";
        normToOrigMap.push(whitespaceStart);
      }
    } else {
      // Normalize specific unicode characters to standard ASCII counterparts
      let normChar = ch;
      if (
        ch === "\u201C" ||
        ch === "\u201D" ||
        ch === "\u201E" ||
        ch === "\u201F" ||
        ch === "\u00AB" ||
        ch === "\u00BB"
      ) {
        normChar = '"';
      } else if (
        ch === "\u2018" ||
        ch === "\u2019" ||
        ch === "\u201A" ||
        ch === "\u201B" ||
        ch === "`" ||
        ch === "\u00B4"
      ) {
        normChar = "'";
      } else if (
        ch === "\u2014" || // em dash
        ch === "\u2013" || // en dash
        ch === "\u2015" || // horizontal bar
        ch === "\u2212"    // minus sign
      ) {
        normChar = "-";
      }

      normalizedText += normChar;
      normToOrigMap.push(i);
      i++;
    }
  }

  // Trim trailing space if any
  if (normalizedText.endsWith(" ")) {
    normalizedText = normalizedText.slice(0, -1);
    normToOrigMap.pop();
  }

  return { normalizedText, normToOrigMap };
}

/**
 * Normalizes a candidate quote string for deterministic search.
 */
export function normalizeCandidateQuote(quote: string): string {
  if (!quote) return "";
  let clean = quote.trim();

  // Strip wrapping quotation marks if the entire quote was enclosed
  if (
    (clean.startsWith('"') && clean.endsWith('"') && clean.length > 1) ||
    (clean.startsWith("'") && clean.endsWith("'") && clean.length > 1) ||
    (clean.startsWith("\u201C") && clean.endsWith("\u201D") && clean.length > 1) ||
    (clean.startsWith("\u2018") && clean.endsWith("\u2019") && clean.length > 1)
  ) {
    clean = clean.slice(1, -1).trim();
  }

  // Apply identical character replacements
  return clean
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'")
    .replace(/[\u2014\u2013\u2015\u2212]/g, "-")
    .replace(/[\s\u00A0\u2000-\u200B\uFEFF]+/g, " ")
    .trim();
}

/**
 * Determines pageStart and pageEnd from original offsets and stored document pages.
 * Never trusts AI page numbers.
 */
export function resolvePageLocation(
  startOffset: number,
  endOffset: number,
  pages?: DocumentPage[]
): { pageStart: number; pageEnd: number; pageNumber: number } {
  if (!pages || pages.length === 0) {
    return { pageStart: 1, pageEnd: 1, pageNumber: 1 };
  }

  // Find pageStart
  let pageStart = 1;
  for (const p of pages) {
    const pStart = p.startOffset ?? 0;
    const pEnd = p.endOffset ?? pStart + (p.text?.length || 0);
    if (startOffset >= pStart && startOffset <= pEnd) {
      pageStart = p.pageNumber;
      break;
    }
    if (startOffset < pStart) {
      // Fallen in gap or before page
      pageStart = Math.max(1, p.pageNumber - 1);
      break;
    }
    pageStart = p.pageNumber;
  }

  // Find pageEnd using last character offset of match
  const lastCharOffset = Math.max(startOffset, endOffset - 1);
  let pageEnd = pageStart;
  for (const p of pages) {
    const pStart = p.startOffset ?? 0;
    const pEnd = p.endOffset ?? pStart + (p.text?.length || 0);
    if (lastCharOffset >= pStart && lastCharOffset <= pEnd) {
      pageEnd = p.pageNumber;
      break;
    }
    if (lastCharOffset < pStart) {
      pageEnd = Math.max(pageStart, p.pageNumber - 1);
      break;
    }
    pageEnd = p.pageNumber;
  }

  // Ensure pageEnd >= pageStart
  if (pageEnd < pageStart) {
    pageEnd = pageStart;
  }

  return {
    pageStart,
    pageEnd,
    pageNumber: pageStart,
  };
}

export const quoteVerificationService = {
  /**
   * Pure deterministic verification function that operates purely on raw document text
   * and page metadata without any database or LLM calls.
   *
   * @param documentText Raw extracted text from document
   * @param candidateQuote Candidate quote string to verify
   * @param pages Page metadata stored with document
   * @param claimedPage Untrusted page hint from AI
   * @param documentId Document ID
   * @param documentName Document filename
   */
  verifyQuoteInText(
    documentText: string,
    candidateQuote: string,
    pages?: DocumentPage[],
    claimedPage?: number,
    documentId?: string,
    documentName?: string
  ): VerifiedQuote {
    const rawQuote = candidateQuote ? candidateQuote.trim() : "";

    // 1. Validation Rule: Quote cannot be empty
    if (!rawQuote) {
      return {
        quoteText: "",
        quote: "",
        isVerified: false,
        verified: false,
        confidenceScore: 0.0,
        exactMatch: false,
        normalizedMatch: false,
        documentId,
        documentName,
        reason: "Quote cannot be empty",
      };
    }

    // 2. Validation Rule: Document text cannot be empty
    if (!documentText || !documentText.trim()) {
      return {
        quoteText: rawQuote,
        quote: rawQuote,
        isVerified: false,
        verified: false,
        confidenceScore: 0.0,
        exactMatch: false,
        normalizedMatch: false,
        documentId,
        documentName,
        reason: "Document contains no readable text",
      };
    }

    const { normalizedText, normToOrigMap } = buildNormalizedIndex(documentText);
    const normalizedCandidate = normalizeCandidateQuote(rawQuote);

    if (!normalizedCandidate) {
      return {
        quoteText: rawQuote,
        quote: rawQuote,
        isVerified: false,
        verified: false,
        confidenceScore: 0.0,
        exactMatch: false,
        normalizedMatch: false,
        documentId,
        documentName,
        reason: "Quote normalization resulted in empty string",
      };
    }

    // Collect all matches to handle duplicate occurrences deterministically
    const matches: QuoteMatchLocation[] = [];
    let isExactMatch = false;
    let isNormalizedMatch = false;

    // Check if raw document text contains verbatim quote
    const exactRawIndex = documentText.indexOf(rawQuote);
    if (exactRawIndex !== -1) {
      isExactMatch = true;
    }

    // Strategy 1: Search exact normalized candidate in normalized text
    let searchPos = 0;
    while (searchPos < normalizedText.length) {
      const foundIdx = normalizedText.indexOf(normalizedCandidate, searchPos);
      if (foundIdx === -1) break;

      const normStart = foundIdx;
      const normEnd = foundIdx + normalizedCandidate.length;

      const startOffset = normToOrigMap[normStart] ?? 0;
      // End offset is the character right after the last matched character
      const lastOrigChar = normToOrigMap[normEnd - 1] ?? startOffset;
      const endOffset = lastOrigChar + 1;

      const originalSnippet = documentText.slice(startOffset, endOffset);
      const pageLoc = resolvePageLocation(startOffset, endOffset, pages);

      // Extract surrounding context (up to 60 characters before & after)
      const ctxBefore = Math.max(0, startOffset - 60);
      const ctxAfter = Math.min(documentText.length, endOffset + 60);
      const surroundingContext =
        (ctxBefore > 0 ? "..." : "") +
        documentText.slice(ctxBefore, ctxAfter).replace(/\s+/g, " ") +
        (ctxAfter < documentText.length ? "..." : "");

      matches.push({
        startOffset,
        endOffset,
        pageNumber: pageLoc.pageNumber,
        pageStart: pageLoc.pageStart,
        pageEnd: pageLoc.pageEnd,
        snippet: originalSnippet,
        surroundingContext,
      });

      isNormalizedMatch = true;
      searchPos = foundIdx + 1;
    }

    // Strategy 2: If no matches, try trimming edge punctuation (trailing period, comma, colon, semicolon)
    if (matches.length === 0) {
      const trimmedCandidate = normalizedCandidate.replace(/[.,;:!?'")\]]+$/, "").trim();
      if (trimmedCandidate.length > 5 && trimmedCandidate !== normalizedCandidate) {
        let tPos = 0;
        while (tPos < normalizedText.length) {
          const foundIdx = normalizedText.indexOf(trimmedCandidate, tPos);
          if (foundIdx === -1) break;

          const normStart = foundIdx;
          const normEnd = foundIdx + trimmedCandidate.length;

          const startOffset = normToOrigMap[normStart] ?? 0;
          const lastOrigChar = normToOrigMap[normEnd - 1] ?? startOffset;
          const endOffset = lastOrigChar + 1;

          const originalSnippet = documentText.slice(startOffset, endOffset);
          const pageLoc = resolvePageLocation(startOffset, endOffset, pages);

          const ctxBefore = Math.max(0, startOffset - 60);
          const ctxAfter = Math.min(documentText.length, endOffset + 60);
          const surroundingContext =
            (ctxBefore > 0 ? "..." : "") +
            documentText.slice(ctxBefore, ctxAfter).replace(/\s+/g, " ") +
            (ctxAfter < documentText.length ? "..." : "");

          matches.push({
            startOffset,
            endOffset,
            pageNumber: pageLoc.pageNumber,
            pageStart: pageLoc.pageStart,
            pageEnd: pageLoc.pageEnd,
            snippet: originalSnippet,
            surroundingContext,
          });

          isNormalizedMatch = true;
          tPos = foundIdx + 1;
        }
      }
    }

    // Strategy 3: Case-insensitive fallback
    if (matches.length === 0) {
      const lowerNormText = normalizedText.toLowerCase();
      const lowerCandidate = normalizedCandidate.toLowerCase();
      let ciPos = 0;

      while (ciPos < lowerNormText.length) {
        const foundIdx = lowerNormText.indexOf(lowerCandidate, ciPos);
        if (foundIdx === -1) break;

        const normStart = foundIdx;
        const normEnd = foundIdx + lowerCandidate.length;

        const startOffset = normToOrigMap[normStart] ?? 0;
        const lastOrigChar = normToOrigMap[normEnd - 1] ?? startOffset;
        const endOffset = lastOrigChar + 1;

        const originalSnippet = documentText.slice(startOffset, endOffset);
        const pageLoc = resolvePageLocation(startOffset, endOffset, pages);

        const ctxBefore = Math.max(0, startOffset - 60);
        const ctxAfter = Math.min(documentText.length, endOffset + 60);
        const surroundingContext =
          (ctxBefore > 0 ? "..." : "") +
          documentText.slice(ctxBefore, ctxAfter).replace(/\s+/g, " ") +
          (ctxAfter < documentText.length ? "..." : "");

        matches.push({
          startOffset,
          endOffset,
          pageNumber: pageLoc.pageNumber,
          pageStart: pageLoc.pageStart,
          pageEnd: pageLoc.pageEnd,
          snippet: originalSnippet,
          surroundingContext,
        });

        isNormalizedMatch = true;
        ciPos = foundIdx + 1;
      }
    }

    // If still no match: Quote does not exist in document
    if (matches.length === 0) {
      return {
        quoteText: rawQuote,
        quote: rawQuote,
        isVerified: false,
        verified: false,
        confidenceScore: 0.0,
        exactMatch: false,
        normalizedMatch: false,
        documentId,
        documentName,
        reason: "Quote not found in document",
      };
    }

    // Handling Duplicate Quotes (Requirement 6):
    // If the quote occurs multiple times, choose primary match:
    // 1. If claimedPage matches one of the matches' pageStart, select it as secondary disambiguation.
    // 2. Otherwise deterministically select the first occurrence in document order.
    let selectedMatch = matches[0];
    if (claimedPage && matches.length > 1) {
      const pageMatch = matches.find((m) => m.pageStart === claimedPage);
      if (pageMatch) {
        selectedMatch = pageMatch;
      }
    }

    const confidenceScore = isExactMatch ? 1.0 : isNormalizedMatch ? 0.95 : 0.85;
    const isMultiPage = (selectedMatch.pageEnd ?? selectedMatch.pageNumber) > selectedMatch.pageStart!;

    const pageDisplay = isMultiPage
      ? `pages ${selectedMatch.pageStart}–${selectedMatch.pageEnd}`
      : `page ${selectedMatch.pageNumber}`;

    const occurrenceNote =
      matches.length > 1
        ? ` (${matches.length} occurrences found in document; primary match selected on ${pageDisplay})`
        : "";

    const verificationNote = isExactMatch
      ? `Exact quote verified on ${pageDisplay}${occurrenceNote}`
      : `Quote verified with normalized whitespace on ${pageDisplay}${occurrenceNote}`;

    return {
      quoteText: selectedMatch.snippet || rawQuote,
      quote: selectedMatch.snippet || rawQuote,
      isVerified: true,
      verified: true,
      confidenceScore,
      exactMatch: isExactMatch,
      normalizedMatch: true,
      documentId,
      documentName,
      claimedPage,
      pageNumber: selectedMatch.pageNumber,
      pageStart: selectedMatch.pageStart,
      pageEnd: selectedMatch.pageEnd,
      startOffset: selectedMatch.startOffset,
      endOffset: selectedMatch.endOffset,
      actualLocation: selectedMatch,
      location: selectedMatch,
      occurrencesCount: matches.length,
      allMatches: matches,
      verificationNote,
    };
  },

  /**
   * Verifies a candidate quote against stored document in MongoDB.
   */
  async verifyQuote(
    documentId: string,
    candidateQuote: string,
    claimedPage?: number
  ): Promise<VerifiedQuote> {
    if (!documentId || typeof documentId !== "string" || !documentId.trim()) {
      return {
        quoteText: candidateQuote || "",
        quote: candidateQuote || "",
        isVerified: false,
        verified: false,
        confidenceScore: 0.0,
        exactMatch: false,
        normalizedMatch: false,
        reason: "A valid documentId is required",
      };
    }

    const cleanDocId = documentId.trim();
    const doc = await documentService.getDocumentById(cleanDocId);

    if (!doc) {
      return {
        quoteText: candidateQuote || "",
        quote: candidateQuote || "",
        isVerified: false,
        verified: false,
        confidenceScore: 0.0,
        exactMatch: false,
        normalizedMatch: false,
        documentId: cleanDocId,
        reason: "Document not found",
      };
    }

    // Validation Rule: Document must be ready
    if (doc.metadata.status !== "ready") {
      return {
        quoteText: candidateQuote || "",
        quote: candidateQuote || "",
        isVerified: false,
        verified: false,
        confidenceScore: 0.0,
        exactMatch: false,
        normalizedMatch: false,
        documentId: cleanDocId,
        documentName: doc.metadata.originalFilename || doc.metadata.name,
        reason: `Document is not ready for quote verification (current status: ${doc.metadata.status})`,
      };
    }

    return this.verifyQuoteInText(
      doc.fullText,
      candidateQuote,
      doc.pages,
      claimedPage,
      cleanDocId,
      doc.metadata.originalFilename || doc.metadata.name
    );
  },

  /**
   * Verifies an array of candidate quotes for a document.
   */
  async verifyQuotes(
    documentId: string,
    candidateQuotes: { text: string; page?: number }[]
  ): Promise<VerifiedQuote[]> {
    if (!candidateQuotes || candidateQuotes.length === 0) {
      return [];
    }

    const cleanDocId = documentId.trim();
    const doc = await documentService.getDocumentById(cleanDocId);
    if (!doc || doc.metadata.status !== "ready") {
      return [];
    }

    const verifiedList: VerifiedQuote[] = [];

    for (const item of candidateQuotes) {
      if (!item.text || !item.text.trim()) continue;
      const res = this.verifyQuoteInText(
        doc.fullText,
        item.text,
        doc.pages,
        item.page,
        cleanDocId,
        doc.metadata.originalFilename || doc.metadata.name
      );
      if (res.isVerified) {
        verifiedList.push(res);
      }
    }

    return verifiedList;
  },
};
