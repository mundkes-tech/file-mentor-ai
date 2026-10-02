"use client";

import React from "react";
import { DocumentMetadata } from "@/types";
import { DocumentListItem } from "./DocumentListItem";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Search, Plus, X, Layers, GitCompare, CheckSquare, Square } from "lucide-react";

interface DocumentSidebarProps {
  documents: DocumentMetadata[];
  allDocumentsCount: number;
  selectedId: string | null;
  selectedIds?: string[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectDocument: (id: string) => void;
  onToggleSelectDocument?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onCompareClick?: () => void;
  onDeleteDocument: (id: string) => void;
  onOpenUpload: () => void;
}

export function DocumentSidebar({
  documents,
  allDocumentsCount,
  selectedId,
  selectedIds = [],
  isLoading,
  searchQuery,
  onSearchChange,
  onSelectDocument,
  onToggleSelectDocument,
  onSelectAll,
  onClearSelection,
  onCompareClick,
  onDeleteDocument,
  onOpenUpload,
}: DocumentSidebarProps) {
  const selectedCount = selectedIds.length;
  const canCompare = selectedCount === 2;

  return (
    <aside className="flex flex-col h-full w-full bg-[#F7F7F5] border-r border-[#E4E1DA]">
      {/* Sidebar Header */}
      <div className="flex flex-col gap-2.5 p-3.5 border-b border-[#E4E1DA] bg-white/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#B7791F]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#171717]">
              Contract Library
            </h2>
            <span className="rounded-full bg-[#F3E8D0] border border-[#E4E1DA] px-2 py-0.2 text-[11px] font-semibold text-[#B7791F]">
              {allDocumentsCount}
            </span>
          </div>

          <Button
            onClick={onOpenUpload}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2 border-[#E4E1DA] hover:bg-[#F3E8D0]/50 text-[#171717]"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Add
          </Button>
        </div>

        {/* Multi-Select Toolbar & Compare Trigger */}
        <div className="flex items-center justify-between text-xs px-0.5">
          <div className="flex items-center gap-2 text-[#6B6B67]">
            <span>
              {selectedCount > 1 ? (
                <span className="font-semibold text-[#B7791F]">
                  {selectedCount} selected
                </span>
              ) : (
                <span>Select for Q&A / Compare</span>
              )}
            </span>
            {selectedCount > 1 && onClearSelection && (
              <button
                onClick={onClearSelection}
                className="text-[11px] text-[#6B6B67] hover:text-[#171717] underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {canCompare && onCompareClick && (
            <Button
              onClick={onCompareClick}
              size="sm"
              className="h-6 text-[11px] px-2.5 bg-[#B7791F] hover:bg-[#9c6517] text-white font-medium shadow-2xs"
              leftIcon={<GitCompare className="h-3 w-3" />}
            >
              Compare (2)
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <Input
          placeholder="Filter contracts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="h-3.5 w-3.5 text-[#6B6B67]" />}
          rightIcon={
            searchQuery ? (
              <button
                onClick={() => onSearchChange("")}
                className="hover:text-[#171717] p-0.5 text-[#6B6B67]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
          className="h-8 text-xs bg-white border-[#E4E1DA] text-[#171717]"
        />
      </div>

      {/* Document List Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          // Skeleton loading state
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center p-8 text-center h-48 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/40 dark:bg-slate-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {searchQuery ? "No matching contracts found" : "No contracts uploaded yet"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              {searchQuery
                ? "Try adjusting your search query."
                : "Upload PDF or DOCX agreements to begin deterministic analysis."}
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentListItem
              key={doc.id}
              document={doc}
              isSelected={doc.id === selectedId}
              isChecked={selectedIds.includes(doc.id)}
              onSelect={onSelectDocument}
              onToggleCheck={onToggleSelectDocument}
              onDelete={onDeleteDocument}
            />
          ))
        )}
      </div>
    </aside>
  );
}
