"use client";

import React from "react";
import { ExtractedDocument } from "@/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { Building2, Calendar, FileText, ShieldAlert, CheckCircle, Info } from "lucide-react";

interface MetadataPanelProps {
  document: ExtractedDocument;
}

export function MetadataPanel({ document }: MetadataPanelProps) {
  const { metadata, clauses } = document;

  const highRiskCount = clauses.filter((c) => c.riskLevel === "high" || c.riskLevel === "critical").length;
  const mediumRiskCount = clauses.filter((c) => c.riskLevel === "medium").length;
  const lowRiskCount = clauses.filter((c) => c.riskLevel === "low").length;

  return (
    <div className="flex flex-col h-full bg-[#F7F7F5] p-6 overflow-y-auto space-y-6">
      {/* Contract Executive Summary */}
      <div className="p-5 rounded-lg border border-[#E4E1DA] bg-white shadow-xs">
        <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-[#B7791F]" />
          Executive Agreement Summary
        </h3>
        <p className="text-xs text-[#171717] leading-relaxed font-serif">
          {metadata.summary || "No executive summary generated yet for this agreement."}
        </p>
      </div>

      {/* Contract Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Parties Card */}
        <div className="p-4 rounded-lg border border-[#E4E1DA] bg-white shadow-xs space-y-2">
          <h4 className="text-xs font-semibold text-[#6B6B67] uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-[#B7791F]" />
            Contracting Parties
          </h4>
          {metadata.parties && metadata.parties.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-[#171717]">
              {metadata.parties.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B7791F]" />
                  <span className="font-medium">{p}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#6B6B67] italic">Parties not extracted</p>
          )}
        </div>

        {/* Key Dates Card */}
        <div className="p-4 rounded-lg border border-[#E4E1DA] bg-white shadow-xs space-y-2">
          <h4 className="text-xs font-semibold text-[#6B6B67] uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#B7791F]" />
            Key Contract Dates
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[11px] text-[#6B6B67] block">Effective Date</span>
              <span className="font-medium text-[#171717]">
                {metadata.effectiveDate ? formatDate(metadata.effectiveDate) : "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#6B6B67] block">Expiration Date</span>
              <span className="font-medium text-[#171717]">
                {metadata.expirationDate ? formatDate(metadata.expirationDate) : "Indefinite / SOW"}
              </span>
            </div>
          </div>
        </div>

        {/* Risk Distribution Card */}
        <div className="p-4 rounded-lg border border-[#E4E1DA] bg-white shadow-xs space-y-3">
          <h4 className="text-xs font-semibold text-[#6B6B67] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-[#B7791F]" />
            Clause Risk Distribution
          </h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 p-2.5 rounded-md bg-[#B94A48]/10 border border-[#B94A48]/20 text-center">
              <span className="text-base font-bold text-[#B94A48]">
                {highRiskCount}
              </span>
              <span className="text-[10px] block text-[#B94A48] uppercase tracking-wider mt-0.5">
                High Risk
              </span>
            </div>
            <div className="flex-1 p-2.5 rounded-md bg-[#F3E8D0] border border-[#B7791F]/30 text-center">
              <span className="text-base font-bold text-[#B7791F]">
                {mediumRiskCount}
              </span>
              <span className="text-[10px] block text-[#B7791F] uppercase tracking-wider mt-0.5">
                Medium Risk
              </span>
            </div>
            <div className="flex-1 p-2.5 rounded-md bg-[#2F7D5A]/10 border border-[#2F7D5A]/20 text-center">
              <span className="text-base font-bold text-[#2F7D5A]">
                {lowRiskCount}
              </span>
              <span className="text-[10px] block text-[#2F7D5A] uppercase tracking-wider mt-0.5">
                Standard
              </span>
            </div>
          </div>
        </div>

        {/* Technical File Metadata */}
        <div className="p-4 rounded-lg border border-[#E4E1DA] bg-white shadow-xs space-y-2">
          <h4 className="text-xs font-semibold text-[#6B6B67] uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[#B7791F]" />
            File & Storage Details
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[11px] text-[#6B6B67] block">File Size</span>
              <span className="font-medium text-[#171717]">
                {formatBytes(metadata.sizeBytes)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#6B6B67] block">Pages</span>
              <span className="font-medium text-[#171717]">
                {metadata.pageCount} Pages
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#6B6B67] block">MIME Type</span>
              <span className="font-mono text-[10px] text-[#171717] truncate block">
                {metadata.mimeType}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#6B6B67] block">Uploaded</span>
              <span className="font-medium text-[#171717]">
                {formatDate(metadata.uploadedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
