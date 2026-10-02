"use client";

import React, { useState } from "react";
import { DocumentMetadata } from "@/types";
import { FileText, Trash2, Calendar, Layers, AlertCircle, Loader2, CheckCircle2, Check } from "lucide-react";
import { formatBytes, formatDate, cn } from "@/lib/utils";

interface DocumentListItemProps {
  document: DocumentMetadata;
  isSelected: boolean;
  isChecked?: boolean;
  onSelect: (id: string) => void;
  onToggleCheck?: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DocumentListItem({
  document,
  isSelected,
  isChecked = false,
  onSelect,
  onToggleCheck,
  onDelete,
}: DocumentListItemProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isPdf =
    document.fileType === "pdf" ||
    document.mimeType === "application/pdf" ||
    document.originalFilename.toLowerCase().endsWith(".pdf");

  const isFailed = document.status === "failed" || document.processingStatus === "failed";
  const isProcessing = document.status === "processing" || document.processingStatus === "processing";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showConfirmDelete) {
      onDelete(document.id);
    } else {
      setShowConfirmDelete(true);
      setTimeout(() => setShowConfirmDelete(false), 3000);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleCheck) {
      onToggleCheck(document.id);
    }
  };

  return (
    <div
      onClick={() => onSelect(document.id)}
      className={cn(
        "group relative flex flex-col gap-2 p-3.5 rounded-lg border transition-all cursor-pointer text-left select-none",
        isSelected
          ? isFailed
            ? "border-[#B94A48] bg-[#B94A48]/5 border-l-4 border-l-[#B94A48]"
            : "border-[#E4E1DA] bg-[#F3E8D0]/60 border-l-4 border-l-[#B7791F] shadow-2xs"
          : isFailed
          ? "border-[#B94A48]/30 bg-[#B94A48]/5 hover:border-[#B94A48]/60"
          : "border-[#E4E1DA] bg-white hover:border-[#B7791F]/50 hover:bg-[#F7F7F5]"
      )}
    >
      {/* Top Row: Icon, Title, Status & Delete Button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Multi-select Checkbox */}
          <button
            type="button"
            onClick={handleCheckboxClick}
            aria-label={`Select ${document.name}`}
            className={cn(
              "mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer",
              isChecked
                ? "border-[#B7791F] bg-[#B7791F] text-white"
                : "border-[#E4E1DA] bg-white hover:border-[#B7791F]"
            )}
          >
            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
          </button>

          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold tracking-tight",
              isFailed
                ? "bg-[#B94A48]/10 text-[#B94A48]"
                : isPdf
                ? "bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA]"
                : "bg-[#E4E1DA]/60 text-[#171717] border border-[#E4E1DA]"
            )}
          >
            {isFailed ? "!" : isPdf ? "PDF" : "DOCX"}
          </div>

          <div className="min-w-0">
            <h4
              className={cn(
                "text-xs font-semibold leading-snug truncate",
                isSelected
                  ? isFailed
                    ? "text-[#B94A48]"
                    : "text-[#171717] font-bold"
                  : "text-[#171717]"
              )}
              title={document.name}
            >
              {document.name}
            </h4>
            <p className="text-[11px] text-[#6B6B67] truncate">
              {document.originalFilename}
            </p>
          </div>
        </div>

        {/* Delete action button */}
        <button
          onClick={handleDelete}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[#6B6B67] hover:text-[#B94A48] hover:bg-[#B94A48]/10",
            showConfirmDelete && "opacity-100 text-[#B94A48] bg-[#B94A48]/10"
          )}
          title={showConfirmDelete ? "Click again to confirm delete" : "Delete contract"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Processing Status / Error Details */}
      {isFailed ? (
        <div className="flex items-center gap-1.5 text-[11px] text-[#B94A48] font-medium">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={document.processingError || "Extraction failed"}>
            {document.processingError || "Extraction failed"}
          </span>
        </div>
      ) : isProcessing ? (
        <div className="flex items-center gap-1.5 text-[11px] text-[#B7791F] font-medium">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span>Processing document...</span>
        </div>
      ) : (
        /* Bottom Metadata & Ready Status */
        <div className="flex items-center justify-between text-[11px] text-[#6B6B67] pt-0.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3 text-[#6B6B67]" />
              {document.pageCount} {document.pageCount === 1 ? "pg" : "pgs"}
            </span>
            <span className="text-[#E4E1DA]">•</span>
            <span>{formatBytes(document.fileSize || document.sizeBytes)}</span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-[#2F7D5A] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D5A]" />
            <span>Ready</span>
          </div>
        </div>
      )}

      {/* Delete confirmation banner */}
      {showConfirmDelete && (
        <span className="text-[10px] text-[#B94A48] font-medium">
          Click trash icon again to confirm
        </span>
      )}
    </div>
  );
}
