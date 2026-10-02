"use client";

import React, { useState, useEffect } from "react";
import { DocumentComparisonResult, ComparisonSection, VerifiedQuote } from "@/types";
import { apiClient } from "@/services/api-client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  X,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Scale,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractComparisonModalProps {
  isOpen: boolean;
  baseDocId: string | null;
  targetDocId: string | null;
  onClose: () => void;
  onSelectCitation: (citation: VerifiedQuote) => void;
}

export function ContractComparisonModal({
  isOpen,
  baseDocId,
  targetDocId,
  onClose,
  onSelectCitation,
}: ContractComparisonModalProps) {
  const [comparison, setComparison] = useState<DocumentComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "differences" | "identical">("all");

  useEffect(() => {
    if (!isOpen || !baseDocId || !targetDocId) {
      setComparison(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const loadComparison = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.compareDocuments(baseDocId, targetDocId);
        if (isMounted) {
          setComparison(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to compare selected contracts.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadComparison();
    return () => {
      isMounted = false;
    };
  }, [isOpen, baseDocId, targetDocId]);

  if (!isOpen) return null;

  const sections = comparison?.sections || [];
  const filteredSections = sections.filter((sec) => {
    if (filterMode === "differences") return sec.hasSubstantiveDifference;
    if (filterMode === "identical") return !sec.hasSubstantiveDifference;
    return true;
  });

  const diffCount = sections.filter((s) => s.hasSubstantiveDifference).length;
  const identicalCount = sections.filter((s) => !s.hasSubstantiveDifference).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div
        className="relative flex flex-col w-full max-w-5xl h-[88vh] max-h-[900px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E1DA] bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA] shadow-2xs">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#171717] tracking-tight">
                  Contract Comparison
                </h2>
                {comparison && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F3E8D0] text-[#B7791F] border border-[#B7791F]/30">
                    {comparison.overallSimilarityPercentage}% Similarity
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B6B67]">
                Deterministic clause-by-clause analysis and substantive difference detection.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#6B6B67] hover:text-[#171717] hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#F7F7F5]">
          {isLoading ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-[#E4E1DA] bg-white space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-lg border border-[#E4E1DA] bg-white space-y-3">
                  <Skeleton className="h-5 w-1/4" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-24 rounded" />
                    <Skeleton className="h-24 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-[#E4E1DA]">
              <AlertTriangle className="h-10 w-10 text-[#B94A48] mb-3" />
              <h3 className="text-sm font-semibold text-[#171717]">
                Comparison Failed
              </h3>
              <p className="text-xs text-[#6B6B67] mt-1 max-w-md">{error}</p>
              <Button onClick={onClose} variant="outline" size="sm" className="mt-4">
                Close
              </Button>
            </div>
          ) : comparison ? (
            <>
              {/* Summary Card */}
              <div className="p-4 rounded-lg border border-[#E4E1DA] bg-white shadow-2xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                      Comparison Summary
                    </h3>
                    <p className="text-xs text-[#6B6B67] leading-relaxed">
                      {comparison.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-[#B7791F]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {diffCount} Differences
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-[#2F7D5A]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {identicalCount} Identical
                    </span>
                  </div>
                </div>

                {/* Compared Contracts Header */}
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-[#E4E1DA]">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#171717]">CONTRACT A:</span>
                    <span className="font-semibold text-[#6B6B67] truncate" title={comparison.baseDocumentName}>
                      {comparison.baseDocumentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#171717]">CONTRACT B:</span>
                    <span className="font-semibold text-[#6B6B67] truncate" title={comparison.targetDocumentName}>
                      {comparison.targetDocumentName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white border border-[#E4E1DA]">
                  <button
                    onClick={() => setFilterMode("all")}
                    className={cn(
                      "px-3 py-1 rounded font-medium transition-colors cursor-pointer",
                      filterMode === "all"
                        ? "bg-[#F3E8D0] text-[#171717] font-semibold border border-[#B7791F]/30"
                        : "text-[#6B6B67] hover:text-[#171717]"
                    )}
                  >
                    All Sections ({sections.length})
                  </button>
                  <button
                    onClick={() => setFilterMode("differences")}
                    className={cn(
                      "px-3 py-1 rounded font-medium transition-colors cursor-pointer",
                      filterMode === "differences"
                        ? "bg-[#F3E8D0] text-[#171717] font-semibold border border-[#B7791F]/30"
                        : "text-[#6B6B67] hover:text-[#171717]"
                    )}
                  >
                    Differences Only ({diffCount})
                  </button>
                  <button
                    onClick={() => setFilterMode("identical")}
                    className={cn(
                      "px-3 py-1 rounded font-medium transition-colors cursor-pointer",
                      filterMode === "identical"
                        ? "bg-[#F3E8D0] text-[#171717] font-semibold border border-[#B7791F]/30"
                        : "text-[#6B6B67] hover:text-[#171717]"
                    )}
                  >
                    Identical ({identicalCount})
                  </button>
                </div>

                <span className="text-[11px] text-[#6B6B67]">
                  Showing {filteredSections.length} of {sections.length} sections
                </span>
              </div>

              {/* Comparison Section Cards */}
              <div className="space-y-4">
                {filteredSections.map((sec) => (
                  <div
                    key={sec.id}
                    className="p-5 rounded-lg border border-[#E4E1DA] bg-white shadow-2xs space-y-3.5"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                          {sec.title}
                        </h4>
                      </div>

                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded border",
                          sec.differenceType === "identical"
                            ? "bg-[#2F7D5A]/10 text-[#2F7D5A] border-[#2F7D5A]/30"
                            : "bg-[#F3E8D0] text-[#B7791F] border-[#B7791F]/30"
                        )}
                      >
                        {sec.differenceType === "identical"
                          ? "Identical"
                          : sec.differenceType === "only_in_doc_a"
                          ? `Only in Contract A`
                          : sec.differenceType === "only_in_doc_b"
                          ? `Only in Contract B`
                          : "Substantive Difference"}
                      </span>
                    </div>

                    {/* Difference Explanation */}
                    {sec.differenceSummary && (
                      <p className="text-xs text-[#6B6B67] bg-[#F7F7F5] p-3 rounded border border-[#E4E1DA] leading-relaxed">
                        <strong className="text-[#171717]">Change Analysis:</strong>{" "}
                        {sec.differenceSummary}
                      </p>
                    )}

                    {/* Side-by-Side Clause Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Side A */}
                      <div className="flex flex-col justify-between p-3.5 rounded border border-[#E4E1DA] bg-[#F7F7F5] text-xs space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-1.5 border-b border-[#E4E1DA] pb-1">
                            <span className="font-bold text-[10.5px] uppercase tracking-wider text-[#171717]">
                              CONTRACT A: {sec.documentA.documentName}
                            </span>
                            <span className="text-[11px] text-[#6B6B67]">
                              Page {sec.documentA.pageNumber || 1}
                            </span>
                          </div>
                          <p className="text-[#171717] font-mono text-[11px] leading-relaxed line-clamp-5">
                            {sec.documentA.text || "— Not specified in contract —"}
                          </p>
                        </div>

                        {/* Verified Citation Button Side A */}
                        {sec.documentA.citation && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCitation(sec.documentA.citation!);
                              onClose();
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2F7D5A] hover:underline cursor-pointer pt-2 border-t border-[#E4E1DA]"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-[#2F7D5A]" />
                            <span>View Verified Passage in Doc A</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Side B */}
                      <div className="flex flex-col justify-between p-3.5 rounded border border-[#E4E1DA] bg-[#F7F7F5] text-xs space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-1.5 border-b border-[#E4E1DA] pb-1">
                            <span className="font-bold text-[10.5px] uppercase tracking-wider text-[#171717]">
                              CONTRACT B: {sec.documentB.documentName}
                            </span>
                            <span className="text-[11px] text-[#6B6B67]">
                              Page {sec.documentB.pageNumber || 1}
                            </span>
                          </div>
                          <p className="text-[#171717] font-mono text-[11px] leading-relaxed line-clamp-5">
                            {sec.documentB.text || "— Not specified in contract —"}
                          </p>
                        </div>

                        {/* Verified Citation Button Side B */}
                        {sec.documentB.citation && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCitation(sec.documentB.citation!);
                              onClose();
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2F7D5A] hover:underline cursor-pointer pt-2 border-t border-[#E4E1DA]"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-[#2F7D5A]" />
                            <span>View Verified Passage in Doc B</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
