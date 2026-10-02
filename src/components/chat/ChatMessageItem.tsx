"use client";

import React, { useState } from "react";
import { ChatMessage, VerifiedQuote } from "@/types";
import {
  Bot,
  User,
  Copy,
  Check,
  CheckCircle2,
  Square,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectCitation?: (citation: VerifiedQuote) => void;
}

export function ChatMessageItem({
  message,
  onSelectCitation,
}: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Verified quotes from deterministic verification engine
  const verifiedQuotes: VerifiedQuote[] = (message.citations || []).filter(
    (c) => c.isVerified || c.verified
  );

  // Unverified candidate quotes that failed verification
  const candidateTexts = (message.candidateQuotes || []).map((cq) => cq.text.trim());
  const unverifiedCandidates = candidateTexts.filter(
    (cText) =>
      !verifiedQuotes.some(
        (vq) =>
          vq.quoteText.trim().toLowerCase() === cText.toLowerCase() ||
          (vq.actualLocation && vq.actualLocation.snippet.trim().toLowerCase() === cText.toLowerCase())
      )
  );

  return (
    <div
      className={`flex gap-3 text-xs leading-relaxed ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Role Avatar */}
      <div
        className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-[#171717] text-white"
            : "bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA] shadow-2xs"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Message Bubble & Content */}
      <div
        className={`flex flex-col max-w-[85%] space-y-2 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`p-3.5 rounded-lg ${
            isUser
              ? "bg-[#171717] text-white"
              : "bg-white border border-[#E4E1DA] text-[#171717] shadow-2xs"
          }`}
        >
          {/* Subtle Retrieval Indicator (Phase 5) */}
          {!isUser && message.retrievalMetadata?.sectionsRetrieved !== undefined && message.retrievalMetadata.sectionsRetrieved > 0 && (
            <div className="mb-2 flex items-center gap-1.5 text-[10px] text-[#6B6B67] font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B7791F]" />
              <span>
                {message.retrievalMetadata.sectionsRetrieved} relevant{" "}
                {message.retrievalMetadata.sectionsRetrieved === 1 ? "section" : "sections"} retrieved
                {message.retrievalMetadata.totalSections && message.retrievalMetadata.isPartial
                  ? ` (from ${message.retrievalMetadata.totalSections} sections)`
                  : ""}
              </span>
            </div>
          )}

          {/* Main message text */}
          <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
            {message.content}
            {message.status === "streaming" && (
              <span className="inline-block w-1.5 h-3.5 bg-[#B7791F] ml-1 animate-pulse align-middle" />
            )}
          </div>

          {/* Stopped generating status */}
          {message.status === "stopped" && (
            <div className="mt-2.5 pt-2 border-t border-[#E4E1DA] flex items-center gap-1.5 text-[11px] text-[#B7791F] font-medium">
              <Square className="h-3 w-3 fill-[#B7791F]" />
              <span>Generation stopped by user (partial content preserved)</span>
            </div>
          )}

          {/* Error status */}
          {message.status === "error" && message.error && (
            <div className="mt-2.5 pt-2 border-t border-[#B94A48]/20 flex items-center gap-1.5 text-[11px] text-[#B94A48] font-medium">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{message.error}</span>
            </div>
          )}

          {/* 1. DETERMINISTICALLY VERIFIED QUOTES (Phase 4) */}
          {verifiedQuotes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#E4E1DA] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F7D5A] flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#2F7D5A]" />
                  Verified Citations ({verifiedQuotes.length})
                </span>
                <span className="text-[9.5px] text-[#2F7D5A] font-medium bg-[#2F7D5A]/10 px-1.5 py-0.5 rounded border border-[#2F7D5A]/30">
                  Ground-Truth
                </span>
              </div>

              {verifiedQuotes.map((vq, idx) => {
                const pageLabel =
                  vq.pageStart && vq.pageEnd && vq.pageStart !== vq.pageEnd
                    ? `pp. ${vq.pageStart}–${vq.pageEnd}`
                    : `Page ${vq.pageNumber || vq.pageStart || 1}`;

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectCitation && onSelectCitation(vq)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectCitation && onSelectCitation(vq);
                      }
                    }}
                    className="p-3 rounded-lg border border-[#E4E1DA] bg-[#F7F7F5] hover:border-[#B7791F] hover:bg-[#F3E8D0]/40 text-left space-y-1.5 group transition-all cursor-pointer shadow-2xs"
                    title={`Click to open ${pageLabel} and highlight this verified passage`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-[#2F7D5A] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-[#2F7D5A]" />
                        ✓ VERIFIED SOURCE
                      </span>
                      <span className="font-semibold text-[#171717] bg-white border border-[#E4E1DA] px-1.5 py-0.5 rounded">
                        {pageLabel}
                      </span>
                    </div>

                    <blockquote className="text-[11px] text-[#171717] italic font-serif pl-2 border-l-2 border-[#2F7D5A] py-0.5">
                      &quot;{vq.quoteText}&quot;
                    </blockquote>

                    <div className="flex items-center justify-between text-[10px] text-[#6B6B67] pt-0.5">
                      <span>{vq.documentId ? `Doc: ${vq.documentId}` : "Authoritative Match"}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#B7791F] group-hover:underline">
                        <span>View Passage</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. UNVERIFIED CANDIDATE QUOTES (Failed Verification) */}
          {unverifiedCandidates.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[#E4E1DA] space-y-1.5">
              <div className="flex items-center gap-1 text-[10px] text-[#B94A48] font-medium">
                <AlertTriangle className="h-3 w-3" />
                <span>Unverified candidate excerpt(s) not found verbatim</span>
              </div>
              {unverifiedCandidates.map((cText, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded bg-[#F7F7F5] border border-[#E4E1DA] text-[10px] text-[#6B6B67] italic line-through"
                >
                  &quot;{cText}&quot;
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Timestamp and Copy Action */}
        <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400">
          <span>{formatDateTime(message.timestamp)}</span>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
