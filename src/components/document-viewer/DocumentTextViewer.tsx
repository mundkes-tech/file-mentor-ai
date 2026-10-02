"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { DocumentPage, VerifiedQuote, VerifiedPassageLocation } from "@/types";
import {
  CheckCircle2,
  X,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  LocateFixed,
  FileText,
} from "lucide-react";

interface DocumentTextViewerProps {
  fullText: string;
  pages?: DocumentPage[];
  fileType?: "pdf" | "docx";
  pageCount?: number;
  searchQuery?: string;
  activeHighlightQuote?: string | null;
  activeCitation?: VerifiedQuote | null;
  activePassageLocation?: VerifiedPassageLocation | null;
  onClearHighlight?: () => void;
  zoomLevel?: number;
  activePage?: number;
  onPageChange?: (page: number) => void;
  highlightStatus?: "normal" | "highlighted" | "loading" | "invalid";
  highlightError?: string | null;
}

export function DocumentTextViewer({
  fullText,
  pages = [],
  fileType = "pdf",
  pageCount = 1,
  searchQuery = "",
  activeHighlightQuote = null,
  activeCitation = null,
  activePassageLocation = null,
  onClearHighlight,
  zoomLevel = 100,
  activePage = 1,
  onPageChange,
  highlightStatus = "normal",
  highlightError = null,
}: DocumentTextViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLElement>(null);
  const [pageInput, setPageInput] = useState<string>(activePage.toString());

  // Keep input in sync with activePage
  useEffect(() => {
    setPageInput(activePage.toString());
  }, [activePage]);

  // Determine effective total pages
  const totalPages = Math.max(pageCount, pages.length, 1);

  // Auto-scroll to highlighted quote/passage when activated
  useEffect(() => {
    if (activePassageLocation && highlightRef.current) {
      const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return () => clearTimeout(timer);
    } else if (activeHighlightQuote && highlightRef.current) {
      const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activePassageLocation, activeHighlightQuote]);

  // Scroll to a specific page element
  const scrollToPage = (pageNum: number) => {
    const safePage = Math.max(1, Math.min(pageNum, totalPages));
    if (onPageChange) {
      onPageChange(safePage);
    }
    const pageEl = document.getElementById(`doc-page-${safePage}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      scrollToPage(parsed);
    } else {
      setPageInput(activePage.toString());
    }
  };

  // Helper to scroll to the active highlight
  const scrollToActiveHighlight = () => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } else if (activePassageLocation) {
      scrollToPage(activePassageLocation.pageStart);
    }
  };

  // Prepare normalized page segments
  const pageSegments = useMemo(() => {
    if (pages && pages.length > 0) {
      return pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text || "",
        startOffset: p.startOffset ?? 0,
        endOffset: p.endOffset ?? (p.startOffset ?? 0) + (p.text?.length || 0),
      }));
    }

    // Fallback: If no explicit pages, treat whole text as 1 page
    return [
      {
        pageNumber: 1,
        text: fullText,
        startOffset: 0,
        endOffset: fullText.length,
      },
    ];
  }, [pages, fullText]);

  // Renders a page's text with exact offset-based citation highlighting and search matching
  const renderPageContent = (
    pageText: string,
    pageStartOffset: number,
    pageEndOffset: number,
    pageNum: number
  ) => {
    // Check if the verified citation overlaps with this page
    const loc = activePassageLocation;
    const hasCitationOverlap =
      loc &&
      loc.startOffset < pageEndOffset &&
      loc.endOffset > pageStartOffset &&
      loc.endOffset > loc.startOffset;

    if (hasCitationOverlap && loc) {
      // Calculate exact local character offsets within this page's text
      const localStart = Math.max(0, loc.startOffset - pageStartOffset);
      const localEnd = Math.min(pageText.length, loc.endOffset - pageStartOffset);

      if (localStart < localEnd && localStart < pageText.length) {
        const preText = pageText.slice(0, localStart);
        const highlightedText = pageText.slice(localStart, localEnd);
        const postText = pageText.slice(localEnd);

        return (
          <div className="whitespace-pre-wrap font-serif leading-relaxed text-[#171717]">
            {renderSearchHighlights(preText)}
            <mark
              id={`citation-highlight-${pageNum}`}
              ref={pageNum === loc.pageStart ? highlightRef : undefined}
              className="bg-[#F3E8D0] text-[#171717] font-medium px-1.5 py-0.5 rounded-xs border-l-2 border-[#B7791F] transition-all"
              title={`Verified Source Citation • Page ${loc.pageStart}${
                loc.pageStart !== loc.pageEnd ? `–${loc.pageEnd}` : ""
              }`}
            >
              {highlightedText}
            </mark>
            {renderSearchHighlights(postText)}
          </div>
        );
      }
    }

    // Fallback: String matching if activeHighlightQuote is set without offset metadata
    const quote = activeHighlightQuote?.trim();
    if (quote && pageText.includes(quote)) {
      const parts = pageText.split(quote);
      return (
        <div className="whitespace-pre-wrap font-serif leading-relaxed text-[#171717]">
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {renderSearchHighlights(part)}
              {i < parts.length - 1 && (
                <mark
                  ref={highlightRef}
                  className="bg-[#F3E8D0] text-[#171717] font-medium px-1.5 py-0.5 rounded-xs border-l-2 border-[#B7791F]"
                >
                  {quote}
                </mark>
              )}
            </React.Fragment>
          ))}
        </div>
      );
    }

    // Standard rendering with search highlights
    return (
      <div className="whitespace-pre-wrap font-serif leading-relaxed text-slate-800 dark:text-slate-200">
        {renderSearchHighlights(pageText)}
      </div>
    );
  };

  // Helper for secondary search query highlighting
  const renderSearchHighlights = (text: string) => {
    const q = searchQuery.trim();
    if (!q || !text) return text;

    try {
      const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <mark
                key={i}
                className="bg-amber-200 text-amber-950 font-medium px-0.5 rounded-xs dark:bg-amber-900/70 dark:text-amber-100"
              >
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F7F5] overflow-hidden">
      {/* 1. Active Citation Notification Banner */}
      {(activePassageLocation || activeHighlightQuote) && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#F3E8D0] border-b border-[#E4E1DA] text-xs text-[#171717] shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[#2F7D5A] shrink-0">
              <ShieldCheck className="h-4 w-4 text-[#2F7D5A]" />
              <span>Verified Citation:</span>
            </div>

            {activePassageLocation ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[11px] bg-white text-[#2F7D5A] border border-[#2F7D5A]/40 shrink-0">
                {activePassageLocation.pageStart === activePassageLocation.pageEnd
                  ? `Page ${activePassageLocation.pageStart}`
                  : `Pages ${activePassageLocation.pageStart}–${activePassageLocation.pageEnd}`}
                {fileType === "docx" && " (Logical)"}
              </span>
            ) : activeCitation?.claimedPage ? (
              <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-white text-[#2F7D5A] border border-[#2F7D5A]/40 shrink-0">
                Page {activeCitation.claimedPage}
              </span>
            ) : null}

            {activePassageLocation && (
              <span className="text-[10px] text-[#6B6B67] font-mono hidden md:inline">
                Offsets {activePassageLocation.startOffset.toLocaleString()}–
                {activePassageLocation.endOffset.toLocaleString()}
              </span>
            )}

            <span className="truncate italic max-w-sm sm:max-w-md text-[#171717]">
              &quot;{activePassageLocation?.quote || activeHighlightQuote}&quot;
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={scrollToActiveHighlight}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-[#171717] bg-white border border-[#E4E1DA] hover:bg-[#F7F7F5] transition-colors cursor-pointer shadow-2xs"
              title="Center view on highlighted passage"
            >
              <LocateFixed className="h-3 w-3 text-[#B7791F]" />
              <span>Jump to Quote</span>
            </button>

            {onClearHighlight && (
              <button
                onClick={onClearHighlight}
                className="p-1 rounded text-[#6B6B67] hover:text-[#171717] hover:bg-black/5 transition-colors cursor-pointer"
                title="Clear Highlight"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Invalid Location or Navigation Error Warning */}
      {highlightStatus === "invalid" && highlightError && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#B94A48]/10 border-b border-[#B94A48]/30 text-xs text-[#B94A48]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#B94A48] shrink-0" />
            <span className="font-semibold">Citation Navigation Notice:</span>
            <span>{highlightError}</span>
          </div>
          {onClearHighlight && (
            <button
              onClick={onClearHighlight}
              className="p-1 text-[#B94A48] hover:text-[#813331]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 3. Page Navigation Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-[#E4E1DA] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#F7F7F5] p-0.5 rounded-lg border border-[#E4E1DA]">
            <button
              onClick={() => scrollToPage(activePage - 1)}
              disabled={activePage <= 1}
              className="p-1 rounded text-[#171717] hover:bg-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1 px-1">
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputSubmit}
                className="w-10 text-center font-mono font-semibold text-xs bg-white border border-[#E4E1DA] rounded py-0.5 text-[#171717]"
              />
              <span className="text-[#6B6B67] font-medium">/ {totalPages}</span>
            </form>

            <button
              onClick={() => scrollToPage(activePage + 1)}
              disabled={activePage >= totalPages}
              className="p-1 rounded text-[#171717] hover:bg-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="text-[11px] text-[#6B6B67]">
            {fileType === "pdf" ? "Physical PDF Pages" : "Logical DOCX Pages"}
          </span>
        </div>

        {activePassageLocation && activePassageLocation.pageStart !== activePage && (
          <button
            onClick={() => scrollToPage(activePassageLocation.pageStart)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold text-[#2F7D5A] bg-[#2F7D5A]/10 border border-[#2F7D5A]/30 hover:bg-[#2F7D5A]/20 transition-colors cursor-pointer"
          >
            <LocateFixed className="h-3 w-3" />
            <span>Go to Quote (Page {activePassageLocation.pageStart})</span>
          </button>
        )}
      </div>

      {/* 4. Scrollable Document Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center gap-8 bg-[#F7F7F5]"
      >
        {pageSegments.map((page) => (
          <div
            key={page.pageNumber}
            id={`doc-page-${page.pageNumber}`}
            style={{ fontSize: `${(zoomLevel / 100) * 14}px` }}
            className={`w-full max-w-4xl bg-white border rounded-lg p-8 md:p-12 transition-all relative ${
              activePassageLocation &&
              activePassageLocation.pageStart <= page.pageNumber &&
              activePassageLocation.pageEnd >= page.pageNumber
                ? "border-[#B7791F] ring-1 ring-[#B7791F]/30"
                : "border-[#E4E1DA]"
            }`}
          >
            {/* Page Header Header Stamp */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#E4E1DA] text-[11px] text-[#6B6B67] select-none">
              <span className="font-semibold uppercase tracking-wider text-[#171717]">
                {fileType === "pdf" ? `Page ${page.pageNumber}` : `Section Page ${page.pageNumber} (Logical)`}
              </span>
              <span>
                Offsets {page.startOffset.toLocaleString()}–{page.endOffset.toLocaleString()}
              </span>
            </div>

            {/* Page Content */}
            {renderPageContent(page.text, page.startOffset, page.endOffset, page.pageNumber)}

            {/* Page Footer */}
            <div className="mt-8 pt-4 border-t border-[#E4E1DA] text-center text-[10px] text-[#6B6B67] select-none">
              — Page {page.pageNumber} of {totalPages} —
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
