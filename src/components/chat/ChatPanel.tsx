"use client";

import React, { useState } from "react";
import { DocumentMetadata, ChatMessage } from "@/types";
import { ChatHeader } from "./ChatHeader";
import { ChatMessageList } from "./ChatMessageList";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatInput } from "./ChatInput";
import { MessageSquare, AlertCircle, Loader2 } from "lucide-react";

interface ChatPanelProps {
  documentMetadata?: DocumentMetadata | null;
  selectedDocuments?: DocumentMetadata[];
  messages: ChatMessage[];
  inputMessage: string;
  setInputMessage: (val: string) => void;
  onSendMessage: (overridePrompt?: string) => void;
  onStopGenerating: () => void;
  onClearChat: () => void;
  onSelectCitation?: (citation: any) => void;
  isStreaming: boolean;
  isLoadingHistory: boolean;
  error: string | null;
}

export function ChatPanel({
  documentMetadata,
  selectedDocuments,
  messages,
  inputMessage,
  setInputMessage,
  onSendMessage,
  onStopGenerating,
  onClearChat,
  onSelectCitation,
  isStreaming,
  isLoadingHistory,
  error,
}: ChatPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isReady = documentMetadata?.status === "ready";
  const isFailed = documentMetadata?.status === "failed";
  const isProcessing = documentMetadata?.status === "processing";

  // When collapsed, render floating mini toggle
  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#B7791F] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#B7791F]/20 hover:bg-[#B7791F]/90 transition-all cursor-pointer"
        aria-label="Open Contract Assistant"
      >
        <MessageSquare className="h-4 w-4" />
        <span>Contract Assistant</span>
        {messages.length > 0 && (
          <span className="rounded-full bg-[#171717] text-white px-1.5 py-0.2 text-[10px]">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#F7F7F5] border-l border-[#E4E1DA]">
      {/* Copilot Header */}
      <ChatHeader
        documentMetadata={documentMetadata}
        selectedDocuments={selectedDocuments}
        messageCount={messages.length}
        onClearChat={onClearChat}
        onToggleCollapse={() => setIsCollapsed(true)}
      />

      {/* Warning banner if document is not ready */}
      {documentMetadata && !isReady && (
        <div className="px-4 py-2.5 bg-[#F3E8D0]/50 border-b border-[#E4E1DA] text-xs text-[#171717] flex items-center gap-2">
          {isProcessing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-[#B7791F]" />
              <span className="text-[#6B6B67]">Document is still processing. Contract analysis will unlock once ready.</span>
            </>
          ) : isFailed ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-[#B94A48] shrink-0" />
              <span className="text-[#B94A48]">
                Cannot question document: processing failed ({documentMetadata.processingError || "text unreadable"}).
              </span>
            </>
          ) : null}
        </div>
      )}

      {/* Message Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {messages.length === 0 ? (
          <ChatEmptyState
            documentName={documentMetadata?.name || "Contract Document"}
            onSelectPrompt={(prompt) => {
              if (isReady) {
                onSendMessage(prompt);
              }
            }}
          />
        ) : (
          <ChatMessageList
            messages={messages}
            onSelectCitation={onSelectCitation}
          />
        )}
      </div>

      {/* Input Field */}
      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        onSendMessage={() => onSendMessage()}
        onStopGenerating={onStopGenerating}
        isStreaming={isStreaming}
        disabled={!documentMetadata || !isReady}
      />
    </div>
  );
}
