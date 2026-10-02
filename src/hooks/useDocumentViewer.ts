"use client";

import { useState, useCallback } from "react";
import { VerifiedQuote, VerifiedPassageLocation, extractPassageLocation } from "@/types";

export type DocumentTab = "text" | "clauses" | "metadata" | "compare";
export type HighlightStatus = "normal" | "highlighted" | "loading" | "invalid";

export interface OpenLocationParams {
  documentId: string;
  startOffset: number;
  endOffset: number;
  pageStart: number;
  pageEnd: number;
  quote?: string;
}

export function useDocumentViewer() {
  const [activeTab, setActiveTab] = useState<DocumentTab>("text");
  const [activeHighlightQuote, setActiveHighlightQuote] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<VerifiedQuote | null>(null);
  const [activePassageLocation, setActivePassageLocation] = useState<VerifiedPassageLocation | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const [highlightStatus, setHighlightStatus] = useState<HighlightStatus>("normal");
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [docSearchQuery, setDocSearchQuery] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Jump to and highlight a specific quote/citation in the document text
  const highlightQuoteInDocument = useCallback((quote: VerifiedQuote | string) => {
    setActiveTab("text");
    setHighlightError(null);

    if (typeof quote === "string") {
      setActiveHighlightQuote(quote);
      setActiveCitation(null);
      setActivePassageLocation(null);
      setHighlightStatus("highlighted");
      return;
    }

    // Must be verified (Phase 4 / Phase 6 requirement)
    if (!quote.isVerified && !quote.verified) {
      setHighlightStatus("invalid");
      setHighlightError("Cannot navigate to unverified candidate quote.");
      return;
    }

    const passage = extractPassageLocation(quote);
    if (!passage) {
      setHighlightStatus("invalid");
      setHighlightError("Citation lacks valid document offset location.");
      return;
    }

    setActiveHighlightQuote(quote.quoteText || quote.quote || passage.quote);
    setActiveCitation(quote);
    setActivePassageLocation(passage);
    setActivePage(passage.pageStart);
    setTargetPage(passage.pageStart);
    setHighlightStatus("highlighted");
  }, []);

  // Open document at a specific location
  const openDocumentAtLocation = useCallback((location: OpenLocationParams) => {
    setActiveTab("text");
    setHighlightError(null);

    if (
      typeof location.startOffset !== "number" ||
      typeof location.endOffset !== "number" ||
      location.startOffset < 0 ||
      location.endOffset <= location.startOffset
    ) {
      setHighlightStatus("invalid");
      setHighlightError("Invalid passage offset boundaries.");
      return;
    }

    const passage: VerifiedPassageLocation = {
      documentId: location.documentId,
      quote: location.quote || "",
      startOffset: location.startOffset,
      endOffset: location.endOffset,
      pageStart: location.pageStart || 1,
      pageEnd: location.pageEnd || location.pageStart || 1,
      verified: true,
    };

    setActiveHighlightQuote(location.quote || null);
    setActiveCitation(null);
    setActivePassageLocation(passage);
    setActivePage(passage.pageStart);
    setTargetPage(passage.pageStart);
    setHighlightStatus("highlighted");
  }, []);

  const clearHighlight = useCallback(() => {
    setActiveHighlightQuote(null);
    setActiveCitation(null);
    setActivePassageLocation(null);
    setTargetPage(null);
    setHighlightStatus("normal");
    setHighlightError(null);
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 10, 160));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 10, 70));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(100);
  }, []);

  return {
    activeTab,
    setActiveTab,
    activeHighlightQuote,
    activeCitation,
    activePassageLocation,
    activePage,
    setActivePage,
    targetPage,
    setTargetPage,
    highlightStatus,
    setHighlightStatus,
    highlightError,
    docSearchQuery,
    setDocSearchQuery,
    zoomLevel,
    highlightQuoteInDocument,
    openDocumentAtLocation,
    clearHighlight,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}
