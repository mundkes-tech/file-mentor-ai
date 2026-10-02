"use client";

import React from "react";
import { ShieldCheck, FileText, UploadCloud, Layers, Sparkles, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DocumentMetadata } from "@/types";
import { APP_CONFIG } from "@/lib/constants";

interface HeaderProps {
  activeDocMetadata?: DocumentMetadata | null;
  onOpenUpload: () => void;
  onOpenRedline?: () => void;
  documentCount: number;
}

export function Header({
  activeDocMetadata,
  onOpenUpload,
  onOpenRedline,
  documentCount,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#E4E1DA] bg-white/95 px-4 md:px-6 backdrop-blur-xs">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA] shadow-2xs">
          <ShieldCheck className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-[#171717]">
              {APP_CONFIG.name}
            </span>
            <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#F7F7F5] text-[#6B6B67] border border-[#E4E1DA]">
              Legal Tech
            </span>
          </div>
          <p className="text-[11px] text-[#6B6B67] hidden sm:block">
            {APP_CONFIG.subtitle}
          </p>
        </div>
      </div>

      {/* Middle: Active Document Indicator */}
      <div className="hidden lg:flex items-center gap-2 max-w-md truncate px-3 py-1 rounded-md bg-[#F7F7F5] border border-[#E4E1DA]">
        <FileText className="h-3.5 w-3.5 text-[#B7791F] shrink-0" />
        {activeDocMetadata ? (
          <div className="flex items-center gap-2 text-xs truncate">
            <span className="font-medium text-[#171717] truncate">
              {activeDocMetadata.name}
            </span>
            <span className="text-[#E4E1DA]">•</span>
            <span className="text-[#6B6B67] shrink-0">
              {activeDocMetadata.pageCount} {activeDocMetadata.pageCount === 1 ? "page" : "pages"}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[#6B6B67] italic">No document selected</span>
        )}
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#6B6B67] bg-[#F7F7F5] px-2.5 py-1 rounded-md border border-[#E4E1DA]">
          <Layers className="h-3.5 w-3.5 text-[#6B6B67]" />
          <span>Library: <strong className="text-[#171717]">{documentCount}</strong></span>
        </div>

        {onOpenRedline && (
          <Button
            onClick={onOpenRedline}
            variant="outline"
            size="sm"
            leftIcon={<FileEdit className="h-3.5 w-3.5 text-[#B7791F]" />}
            className="border-[#E4E1DA] hover:bg-[#F3E8D0]/50 text-[#171717] h-8 text-xs"
          >
            <span className="hidden sm:inline">Redline DOCX</span>
            <span className="sm:hidden">Redline</span>
          </Button>
        )}

        <Button
          onClick={onOpenUpload}
          variant="primary"
          size="sm"
          leftIcon={<UploadCloud className="h-3.5 w-3.5" />}
          className="h-8 text-xs"
        >
          <span className="hidden sm:inline">Upload Contract</span>
          <span className="sm:hidden">Upload</span>
        </Button>
      </div>
    </header>
  );
}
