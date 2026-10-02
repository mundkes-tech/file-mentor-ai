"use client";

import React from "react";
import { Sparkles, HelpCircle, ArrowUpRight } from "lucide-react";
import { SAMPLE_SUGGESTED_PROMPTS } from "@/lib/constants";

interface ChatEmptyStateProps {
  documentName: string;
  onSelectPrompt: (prompt: string) => void;
}

export function ChatEmptyState({
  documentName,
  onSelectPrompt,
}: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full">
      <div className="h-10 w-10 rounded-lg bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA] flex items-center justify-center mb-3 shadow-2xs">
        <Sparkles className="h-5 w-5" />
      </div>

      <h4 className="text-sm font-bold text-[#171717] tracking-tight">
        Contract Assistant
      </h4>
      <p className="text-xs text-[#6B6B67] mt-1 max-w-[260px] leading-relaxed">
        Ask legal questions about <strong className="text-[#171717] font-semibold">{documentName}</strong> with deterministic verified source attribution.
      </p>

      {/* Suggested prompts list */}
      <div className="w-full mt-5 space-y-2 text-left">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B6B67] block px-1">
          Suggested Questions:
        </span>
        {SAMPLE_SUGGESTED_PROMPTS.slice(0, 3).map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelectPrompt(prompt)}
            className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[#E4E1DA] bg-white hover:border-[#B7791F] hover:bg-[#F3E8D0]/40 text-xs text-[#171717] transition-all group text-left cursor-pointer shadow-2xs"
          >
            <span className="truncate pr-2">{prompt}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#6B6B67] group-hover:text-[#B7791F] shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
