export interface QuoteMatchLocation {
  pageNumber: number;
  pageStart?: number;
  pageEnd?: number;
  startOffset: number;
  endOffset: number;
  snippet: string;
  surroundingContext?: string;
}

export interface VerifiedQuote {
  // Primary fields
  quoteText: string;
  quote?: string; // Convenience alias for quoteText
  isVerified: boolean;
  verified?: boolean; // Convenience alias for isVerified
  confidenceScore: number;
  exactMatch: boolean;
  normalizedMatch: boolean;
  
  // Location & Document metadata
  documentId?: string;
  documentName?: string;
  claimedPage?: number;
  actualLocation?: QuoteMatchLocation;
  location?: QuoteMatchLocation; // Convenience alias for actualLocation
  pageNumber?: number;
  pageStart?: number;
  pageEnd?: number;
  startOffset?: number;
  endOffset?: number;

  // Duplicate / Multi-occurrence tracking
  occurrencesCount?: number;
  allMatches?: QuoteMatchLocation[];

  // Explanatory notes & failure reasons
  verificationNote?: string;
  reason?: string;
}

export interface VerificationRequest {
  documentId: string;
  quote: string;
  claimedPage?: number;
}

/**
 * Clean internal representation for an authoritatively verified document passage location (Phase 6).
 */
export interface VerifiedPassageLocation {
  documentId: string;
  quote: string;
  startOffset: number;
  endOffset: number;
  pageStart: number;
  pageEnd: number;
  verified: true;
  occurrenceIndex?: number;
  totalOccurrences?: number;
  isLogicalPage?: boolean;
}

/**
 * Safely extracts a VerifiedPassageLocation from a VerifiedQuote.
 * Returns null if the quote is not verified or lacks valid offset metadata.
 */
export function extractPassageLocation(
  quote: VerifiedQuote | null | undefined
): VerifiedPassageLocation | null {
  if (!quote || (!quote.isVerified && !quote.verified)) {
    return null;
  }

  const startOffset =
    quote.startOffset ??
    quote.actualLocation?.startOffset ??
    quote.location?.startOffset;

  const endOffset =
    quote.endOffset ??
    quote.actualLocation?.endOffset ??
    quote.location?.endOffset;

  const pageStart =
    quote.pageStart ??
    quote.actualLocation?.pageStart ??
    quote.pageNumber ??
    1;

  const pageEnd =
    quote.pageEnd ??
    quote.actualLocation?.pageEnd ??
    quote.pageNumber ??
    pageStart;

  if (
    typeof startOffset !== "number" ||
    typeof endOffset !== "number" ||
    startOffset < 0 ||
    endOffset <= startOffset
  ) {
    return null;
  }

  return {
    documentId: quote.documentId || "",
    quote: quote.quoteText || quote.quote || "",
    startOffset,
    endOffset,
    pageStart,
    pageEnd,
    verified: true,
    totalOccurrences: quote.occurrencesCount,
  };
}
