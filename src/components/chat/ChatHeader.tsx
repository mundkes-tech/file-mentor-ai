"use client";

import React from "react";
import { MessageSquare, Trash2, ChevronRight, Layers, FileText } from "lucide-react";
import { DocumentMetadata } from "@/types";

interface ChatHeaderProps {
  documentMetadata?: DocumentMetadata | null;
  selectedDocuments?: DocumentMetadata[];
  messageCount: number;
  onClearChat: () => void;
  onToggleCollapse: () => void;
}

export function ChatHeader({
  documentMetadata,
  selectedDocuments,
  messageCount,
  onClearChat,
  onToggleCollapse,
}: ChatHeaderProps) {
  const isMultiDoc = selectedDocuments && selectedDocuments.length > 1;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E1DA] bg-white/90">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-lg bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA] flex items-center justify-center shrink-0">
          <MessageSquare className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#171717]">
            Contract Assistant
          </h3>
          {isMultiDoc ? (
            <p className="text-[11px] text-[#6B6B67] truncate">
              Grounded in {selectedDocuments.length} selected contracts
            </p>
          ) : documentMetadata ? (
            <p className="text-[11px] text-[#6B6B67] truncate">
              Grounded in <span className="text-[#171717] font-medium">{documentMetadata.originalFilename}</span>
            </p>
          ) : (
            <p className="text-[11px] text-[#6B6B67] italic">Grounded in selected document(s)</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {messageCount > 0 && (
          <button
            onClick={onClearChat}
            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear conversation history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Collapse panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
