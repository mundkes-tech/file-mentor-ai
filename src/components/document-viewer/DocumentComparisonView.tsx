"use client";

import React, { useState } from "react";
import { DocumentMetadata, ComparisonClauseDiff } from "@/types";
import { GitCompare, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DocumentComparisonViewProps {
  currentDocument: DocumentMetadata;
  allDocuments: DocumentMetadata[];
}

export function DocumentComparisonView({
  currentDocument,
  allDocuments,
}: DocumentComparisonViewProps) {
  const otherDocs = allDocuments.filter((d) => d.id !== currentDocument.id);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    otherDocs.length > 0 ? otherDocs[0].id : ""
  );

  const sampleDiffs: ComparisonClauseDiff[] = [
    {
      clauseKey: "liability_cap",
      title: "Limitation of Liability Cap",
      docAContent:
        "Total aggregate liability limited to fees paid in preceding 12 months, with exceptions for confidentiality and indemnification.",
      docBContent:
        "Total aggregate liability capped at a fixed $50,000 ceiling, regardless of actual trailing contract fees paid.",
      status: "modified",
      diffSummary: "Shift from dynamic 12-month trailing fee cap to fixed $50,000 ceiling.",
      riskChange: "increased",
    },
    {
      clauseKey: "termination_notice",
      title: "Termination for Convenience Notice",
      docAContent: "Forty-five (45) calendar days prior written notice.",
      docBContent: "Sixty (60) calendar days prior written notice with automatic renewal.",
      status: "modified",
      diffSummary: "Notice window increased by 15 days and auto-renewal term added.",
      riskChange: "increased",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F7F7F5] p-6 overflow-y-auto space-y-6">
      {/* Comparison Selector Header */}
      <div className="p-4 rounded-lg border border-[#E4E1DA] bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#F3E8D0] text-[#B7791F] flex items-center justify-center border border-[#E4E1DA]">
            <GitCompare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">
              Clause-by-Clause Contract Comparison
            </h3>
            <p className="text-xs text-[#6B6B67]">
              Compare provisions across agreements to identify risk deviations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B6B67]">Compare with:</span>
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            className="rounded-md border border-[#E4E1DA] bg-white px-3 py-1.5 text-xs text-[#171717] focus:ring-1 focus:ring-[#B7791F]"
          >
            {otherDocs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Preview Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B67] uppercase tracking-wider px-1">
          <span>Identified Clause Differences</span>
          <span className="text-[#B7791F] font-mono">
            {sampleDiffs.length} Variances Detected
          </span>
        </div>

        {sampleDiffs.map((diff) => (
          <div
            key={diff.clauseKey}
            className="rounded-lg border border-[#E4E1DA] bg-white p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#171717]">
                {diff.title}
              </h4>
              <span className="rounded-full bg-[#F3E8D0] text-[#B7791F] border border-[#B7791F]/30 px-2 py-0.5 text-[11px] font-semibold">
                Risk {diff.riskChange}
              </span>
            </div>

            <p className="text-xs text-[#171717] bg-[#F7F7F5] p-2.5 rounded-md border border-[#E4E1DA]">
              <strong className="text-[#171717]">Difference: </strong>
              {diff.diffSummary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-md border border-[#E4E1DA] bg-[#F7F7F5]">
                <span className="text-[11px] font-semibold text-[#B7791F] block mb-1">
                  Current Document: {currentDocument.name}
                </span>
                <p className="text-xs text-[#171717] font-serif leading-relaxed">
                  &quot;{diff.docAContent}&quot;
                </p>
              </div>

              <div className="p-3 rounded-md border border-[#E4E1DA] bg-[#F7F7F5]">
                <span className="text-[11px] font-semibold text-[#6B6B67] block mb-1">
                  Target Document Comparison
                </span>
                <p className="text-xs text-[#171717] font-serif leading-relaxed">
                  &quot;{diff.docBContent}&quot;
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
