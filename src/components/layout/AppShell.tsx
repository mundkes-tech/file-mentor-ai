"use client";

import React, { useState } from "react";
import { Header } from "./Header";
import { DocumentSidebar } from "@/components/sidebar/DocumentSidebar";
import { DocumentWorkspace } from "@/components/document-viewer/DocumentWorkspace";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { UploadModal } from "@/components/sidebar/UploadModal";
import { ContractComparisonModal } from "@/components/comparison/ContractComparisonModal";
import { ContractRedlineModal } from "@/components/redline/ContractRedlineModal";
import { useDocuments } from "@/hooks/useDocuments";
import { useChat } from "@/hooks/useChat";
import { useDocumentViewer } from "@/hooks/useDocumentViewer";
import { Menu, X, MessageSquare } from "lucide-react";

export function AppShell() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isRedlineOpen, setIsRedlineOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Core Hooks
  const {
    documents,
    allDocumentsCount,
    selectedId,
    selectedIds,
    isMultiSelect,
    activeDocument,
    isLoading: isLoadingDocs,
    isLoadingActiveDoc,
    error: docError,
    searchQuery,
    setSearchQuery,
    selectDocument,
    toggleSelectDocument,
    selectAllDocuments,
    clearSelectedDocuments,
    uploadDocument,
    deleteDocument,
    reloadDocuments,
    setError: setDocError,
  } = useDocuments();

  const {
    messages,
    inputMessage,
    setInputMessage,
    isStreaming,
    isLoadingHistory,
    error: chatError,
    sendMessage,
    stopGenerating,
    clearChat,
  } = useChat(selectedId, selectedIds);

  const [pendingCitation, setPendingCitation] = useState<any | null>(null);

  const {
    activeTab,
    setActiveTab,
    activeHighlightQuote,
    activeCitation,
    activePassageLocation,
    activePage,
    setActivePage,
    highlightStatus,
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
  } = useDocumentViewer();

  // Handle citation click from chat with document isolation & auto-switch
  const handleSelectCitation = (citation: any) => {
    if (!citation) return;

    // Reject unverified candidate quotes from triggering document navigation (Requirement 9)
    if (!citation.isVerified && !citation.verified) {
      return;
    }

    const citationDocId = citation.documentId;

    // Document Isolation (Requirement 15):
    // If citation references another document, switch documents cleanly via valid loader
    if (citationDocId && citationDocId !== selectedId) {
      const targetDoc = documents.find((d) => d.id === citationDocId);
      if (targetDoc) {
        clearHighlight();
        selectDocument(citationDocId);
        setPendingCitation(citation);
      }
      setIsMobileChatOpen(false);
      return;
    }

    highlightQuoteInDocument(citation);
    setIsMobileChatOpen(false);
  };

  // When a pending citation's target document finishes loading, apply the highlight
  React.useEffect(() => {
    if (
      pendingCitation &&
      activeDocument &&
      activeDocument.metadata.id === pendingCitation.documentId
    ) {
      highlightQuoteInDocument(pendingCitation);
      setPendingCitation(null);
    }
  }, [pendingCitation, activeDocument, highlightQuoteInDocument]);

  const selectedDocsList = documents.filter((d) => selectedIds.includes(d.id));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F7F7F5] text-[#171717] font-sans">
      {/* Top Header */}
      <Header
        activeDocMetadata={activeDocument?.metadata}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenRedline={() => setIsRedlineOpen(true)}
        documentCount={allDocumentsCount}
      />

      {/* Mobile Toggle Bar */}
      <div className="flex md:hidden items-center justify-between px-4 py-2 bg-white border-b border-[#E4E1DA] text-xs">
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="flex items-center gap-1.5 font-medium text-[#171717]"
        >
          <Menu className="h-4 w-4 text-[#6B6B67]" />
          <span>Contracts ({allDocumentsCount})</span>
        </button>

        <button
          onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
          className="flex items-center gap-1.5 font-medium text-[#B7791F]"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Assistant ({messages.length})</span>
        </button>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Column: Sidebar Document Library (Desktop) */}
        <div className="hidden md:flex w-72 lg:w-80 shrink-0 h-full">
          <DocumentSidebar
            documents={documents}
            allDocumentsCount={allDocumentsCount}
            selectedId={selectedId}
            selectedIds={selectedIds}
            isLoading={isLoadingDocs}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectDocument={(id) => {
              clearHighlight();
              selectDocument(id);
            }}
            onToggleSelectDocument={toggleSelectDocument}
            onSelectAll={selectAllDocuments}
            onClearSelection={clearSelectedDocuments}
            onCompareClick={() => setIsComparisonOpen(true)}
            onDeleteDocument={deleteDocument}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        </div>

        {/* Mobile Drawer: Sidebar */}
        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div className="relative w-4/5 max-w-xs h-full bg-white dark:bg-slate-950 shadow-xl z-50">
              <DocumentSidebar
                documents={documents}
                allDocumentsCount={allDocumentsCount}
                selectedId={selectedId}
                selectedIds={selectedIds}
                isLoading={isLoadingDocs}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectDocument={(id) => {
                  clearHighlight();
                  selectDocument(id);
                  setIsMobileSidebarOpen(false);
                }}
                onToggleSelectDocument={toggleSelectDocument}
                onSelectAll={selectAllDocuments}
                onClearSelection={clearSelectedDocuments}
                onCompareClick={() => {
                  setIsMobileSidebarOpen(false);
                  setIsComparisonOpen(true);
                }}
                onDeleteDocument={deleteDocument}
                onOpenUpload={() => {
                  setIsMobileSidebarOpen(false);
                  setIsUploadOpen(true);
                }}
              />
            </div>
          </div>
        )}

        {/* Center Column: Main Document Workspace */}
        <main className="flex-1 h-full min-w-0 overflow-hidden">
          <DocumentWorkspace
            activeDocument={activeDocument}
            allDocuments={documents}
            isLoading={isLoadingActiveDoc}
            error={docError}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeHighlightQuote={activeHighlightQuote}
            activeCitation={activeCitation}
            activePassageLocation={activePassageLocation}
            activePage={activePage}
            onPageChange={setActivePage}
            highlightStatus={highlightStatus}
            highlightError={highlightError}
            onClearHighlight={clearHighlight}
            docSearchQuery={docSearchQuery}
            setDocSearchQuery={setDocSearchQuery}
            zoomLevel={zoomLevel}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            resetZoom={resetZoom}
            onOpenUpload={() => setIsUploadOpen(true)}
            onSelectSample={(id) => selectDocument(id)}
            onRetry={reloadDocuments}
          />
        </main>

        {/* Right Column: AI Chat Panel (Desktop) */}
        <div className="hidden xl:flex w-96 lg:w-[420px] shrink-0 h-full">
          <ChatPanel
            documentMetadata={activeDocument?.metadata}
            selectedDocuments={selectedDocsList}
            messages={messages}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSendMessage={sendMessage}
            onStopGenerating={stopGenerating}
            onClearChat={clearChat}
            onSelectCitation={handleSelectCitation}
            isStreaming={isStreaming}
            isLoadingHistory={isLoadingHistory}
            error={chatError}
          />
        </div>

        {/* Mobile / Tablet Drawer: Chat Panel */}
        {isMobileChatOpen && (
          <div className="xl:hidden fixed inset-0 z-40 flex justify-end">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setIsMobileChatOpen(false)}
            />
            <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 shadow-xl z-50 flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Contract AI Copilot
                </span>
                <button
                  onClick={() => setIsMobileChatOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel
                  documentMetadata={activeDocument?.metadata}
                  selectedDocuments={selectedDocsList}
                  messages={messages}
                  inputMessage={inputMessage}
                  setInputMessage={setInputMessage}
                  onSendMessage={sendMessage}
                  onStopGenerating={stopGenerating}
                  onClearChat={clearChat}
                  onSelectCitation={handleSelectCitation}
                  isStreaming={isStreaming}
                  isLoadingHistory={isLoadingHistory}
                  error={chatError}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contract Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={uploadDocument}
      />

      {/* Contract Comparison Modal */}
      <ContractComparisonModal
        isOpen={isComparisonOpen && selectedIds.length >= 2}
        baseDocId={selectedIds[0] || null}
        targetDocId={selectedIds[1] || null}
        onClose={() => setIsComparisonOpen(false)}
        onSelectCitation={handleSelectCitation}
      />

      {/* Contract Redlining Modal (Phase 8 Part C) */}
      <ContractRedlineModal
        isOpen={isRedlineOpen}
        documents={documents}
        defaultOriginalId={selectedIds[0] || selectedId}
        defaultUpdatedId={selectedIds[1] || null}
        onClose={() => setIsRedlineOpen(false)}
      />
    </div>
  );
}
