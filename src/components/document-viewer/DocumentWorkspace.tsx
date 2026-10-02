"use client";

import React from "react";
import { ExtractedDocument, DocumentMetadata, VerifiedQuote } from "@/types";
import { DocumentTextViewer } from "./DocumentTextViewer";
import { ClauseOverview } from "./ClauseOverview";
import { MetadataPanel } from "./MetadataPanel";
import { DocumentComparisonView } from "./DocumentComparisonView";
import { DocumentEmptyState } from "./DocumentEmptyState";
import { DocumentLoadingState } from "./DocumentLoadingState";
import { DocumentErrorState } from "./DocumentErrorState";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import {
  FileText,
  ListChecks,
  Info,
  GitCompare,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  FileCheck,
} from "lucide-react";
import { DocumentTab, HighlightStatus } from "@/hooks/useDocumentViewer";
import { VerifiedPassageLocation } from "@/types";

interface DocumentWorkspaceProps {
  activeDocument: ExtractedDocument | null;
  allDocuments: DocumentMetadata[];
  isLoading: boolean;
  error: string | null;
  activeTab: DocumentTab;
  setActiveTab: (tab: DocumentTab) => void;
  activeHighlightQuote: string | null;
  activeCitation: VerifiedQuote | null;
  activePassageLocation?: VerifiedPassageLocation | null;
  activePage?: number;
  onPageChange?: (page: number) => void;
  highlightStatus?: HighlightStatus;
  highlightError?: string | null;
  onClearHighlight: () => void;
  docSearchQuery: string;
  setDocSearchQuery: (q: string) => void;
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  onOpenUpload: () => void;
  onSelectSample: (id: string) => void;
  onRetry: () => void;
}

export function DocumentWorkspace({
  activeDocument,
  allDocuments,
  isLoading,
  error,
  activeTab,
  setActiveTab,
  activeHighlightQuote,
  activeCitation,
  activePassageLocation = null,
  activePage = 1,
  onPageChange,
  highlightStatus = "normal",
  highlightError = null,
  onClearHighlight,
  docSearchQuery,
  setDocSearchQuery,
  zoomLevel,
  zoomIn,
  zoomOut,
  resetZoom,
  onOpenUpload,
  onSelectSample,
  onRetry,
}: DocumentWorkspaceProps) {
  // If error state active
  if (error) {
    return (
      <DocumentErrorState
        error={error}
        onRetry={onRetry}
        onReset={() => onSelectSample("doc-sample-1")}
      />
    );
  }

  // If loading state active
  if (isLoading) {
    return <DocumentLoadingState />;
  }

  // If no document selected (empty state)
  if (!activeDocument) {
    return (
      <DocumentEmptyState
        onOpenUpload={onOpenUpload}
        onSelectSample={onSelectSample}
        hasDocuments={allDocuments.length > 0}
      />
    );
  }

  const { metadata, fullText, clauses } = activeDocument;

  // If document processing failed (e.g., scanned PDF or corrupted file)
  if (metadata.status === "failed" || metadata.processingStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#F7F7F5]">
        <div className="max-w-md flex flex-col items-center p-6 rounded-xl bg-white border border-[#B94A48]/30 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#B94A48]/10 text-[#B94A48] mb-4">
            <X className="h-7 w-7" />
          </div>

          <h3 className="text-base font-semibold text-[#171717]">
            Document Extraction Failed
          </h3>
          <p className="text-xs text-[#B94A48] mt-2 font-medium bg-[#B94A48]/5 p-3 rounded-md border border-[#B94A48]/20 text-left w-full leading-relaxed">
            {metadata.processingError ||
              "Unable to extract readable text from this PDF. It may be a scanned/image-only document."}
          </p>
          <p className="text-xs text-[#6B6B67] mt-3 leading-relaxed">
            FileMentor AI requires digital text-based contracts for deterministic quote verification and clause indexing.
          </p>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={onOpenUpload}
              className="px-4 py-2 rounded-md bg-[#B7791F] hover:bg-[#B7791F]/90 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Upload Text Contract
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabsConfig = [
    {
      id: "text",
      label: "Contract Text",
      icon: <FileText className="h-3.5 w-3.5" />,
      count: metadata.pageCount,
    },
    {
      id: "clauses",
      label: "Clauses & Risks",
      icon: <ListChecks className="h-3.5 w-3.5" />,
      count: clauses.length,
    },
    {
      id: "metadata",
      label: "Agreement Overview",
      icon: <Info className="h-3.5 w-3.5" />,
    },
    {
      id: "compare",
      label: "Compare Contracts",
      icon: <GitCompare className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Workspace Header Toolbar */}
      <div className="flex flex-col border-b border-[#E4E1DA] bg-[#F7F7F5]">
        {/* Document Title & Quick Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-[#171717] truncate tracking-tight">
                {metadata.name}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3E8D0] text-[#B7791F] border border-[#B7791F]/30">
                <FileCheck className="h-3 w-3" />
                Indexed
              </span>
            </div>
            <p className="text-xs text-[#6B6B67] truncate mt-0.5">
              {metadata.originalFilename} • {metadata.pageCount} pages • {clauses.length} extracted clauses
            </p>
          </div>

          {/* Right Toolbar: In-Document Search & Zoom */}
          <div className="flex items-center gap-2">
            {/* Search within document */}
            {activeTab === "text" && (
              <div className="w-44 sm:w-56">
                <Input
                  placeholder="Find in document..."
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-3.5 w-3.5 text-[#6B6B67]" />}
                  rightIcon={
                    docSearchQuery ? (
                      <button
                        onClick={() => setDocSearchQuery("")}
                        className="hover:text-[#171717] text-[#6B6B67]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null
                  }
                  className="h-8 text-xs bg-white border-[#E4E1DA]"
                />
              </div>
            )}

            {/* Zoom Controls (Text view only) */}
            {activeTab === "text" && (
              <div className="flex items-center rounded-md border border-[#E4E1DA] bg-white p-0.5">
                <button
                  onClick={zoomOut}
                  className="p-1 rounded-sm text-[#6B6B67] hover:text-[#171717] hover:bg-[#E4E1DA]/40 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  className="px-1.5 text-[11px] font-mono text-[#6B6B67] hover:text-[#171717]"
                  title="Reset Zoom"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={zoomIn}
                  className="p-1 rounded-sm text-[#6B6B67] hover:text-[#171717] hover:bg-[#E4E1DA]/40 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* View Tabs */}
        <Tabs
          tabs={tabsConfig}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as DocumentTab)}
        />
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "text" && (
          <DocumentTextViewer
            fullText={fullText}
            pages={activeDocument.pages || []}
            fileType={metadata.fileType}
            pageCount={metadata.pageCount}
            searchQuery={docSearchQuery}
            activeHighlightQuote={activeHighlightQuote}
            activeCitation={activeCitation}
            activePassageLocation={activePassageLocation}
            activePage={activePage}
            onPageChange={onPageChange}
            highlightStatus={highlightStatus}
            highlightError={highlightError}
            onClearHighlight={onClearHighlight}
            zoomLevel={zoomLevel}
          />
        )}

        {activeTab === "clauses" && (
          <ClauseOverview
            clauses={clauses}
            onSelectClause={(text) => {
              setActiveTab("text");
              onClearHighlight();
              setTimeout(() => {
                // Set highlight to first sentence of clause
                const snippet = text.slice(0, 100);
                // Highlight will find it
              }, 50);
            }}
          />
        )}

        {activeTab === "metadata" && <MetadataPanel document={activeDocument} />}

        {activeTab === "compare" && (
          <DocumentComparisonView
            currentDocument={metadata}
            allDocuments={allDocuments}
          />
        )}
      </div>
    </div>
  );
}
