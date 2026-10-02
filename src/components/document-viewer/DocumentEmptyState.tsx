"use client";

import React from "react";
import { FileSearch, UploadCloud, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DocumentEmptyStateProps {
  onOpenUpload: () => void;
  onSelectSample?: (id: string) => void;
  hasDocuments: boolean;
}

export function DocumentEmptyState({
  onOpenUpload,
  onSelectSample,
  hasDocuments,
}: DocumentEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#F7F7F5]">
      <div className="max-w-md flex flex-col items-center">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA] mb-4 shadow-xs">
          <FileSearch className="h-8 w-8" />
        </div>

        <h3 className="text-lg font-semibold text-[#171717] tracking-tight">
          No Contract Selected
        </h3>
        <p className="text-xs text-[#6B6B67] mt-2 leading-relaxed">
          {hasDocuments
            ? "Choose a contract from the library to inspect clauses, examine verified quotes, or ask analytical questions."
            : "Upload an NDA, Master Services Agreement, or SaaS License in PDF or DOCX format to begin analysis."}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Button
            onClick={onOpenUpload}
            variant="primary"
            size="sm"
            leftIcon={<UploadCloud className="h-4 w-4" />}
          >
            Upload Contract
          </Button>

          {hasDocuments && onSelectSample && (
            <Button
              onClick={() => onSelectSample("doc-sample-1")}
              variant="outline"
              size="sm"
              leftIcon={<Shield className="h-4 w-4 text-[#B7791F]" />}
            >
              Open Sample MSA
            </Button>
          )}
        </div>

        {/* Informative Tips */}
        <div className="mt-10 grid grid-cols-2 gap-3 text-left w-full">
          <div className="p-3.5 rounded-lg border border-[#E4E1DA] bg-white shadow-xs">
            <span className="text-xs font-semibold text-[#171717] block mb-1">
              Deterministic Verification
            </span>
            <span className="text-[11px] text-[#6B6B67] leading-normal">
              Quotes are verified against authoritative document text with exact character-offset matching.
            </span>
          </div>
          <div className="p-3.5 rounded-lg border border-[#E4E1DA] bg-white shadow-xs">
            <span className="text-xs font-semibold text-[#171717] block mb-1">
              Multi-Page Scalability
            </span>
            <span className="text-[11px] text-[#6B6B67] leading-normal">
              Designed to scale up to large 150-page enterprise agreements and complex cross-contract comparisons.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
