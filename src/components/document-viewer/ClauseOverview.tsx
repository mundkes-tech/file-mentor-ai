"use client";

import React, { useState } from "react";
import { DocumentClause } from "@/types";
import { RiskBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ShieldAlert, Eye, Search, Layers, FileCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface ClauseOverviewProps {
  clauses: DocumentClause[];
  onSelectClause: (clauseText: string) => void;
}

export function ClauseOverview({
  clauses,
  onSelectClause,
}: ClauseOverviewProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchClause, setSearchClause] = useState<string>("");

  const categories = [
    { id: "all", label: "All Clauses" },
    { id: "liability", label: "Liability" },
    { id: "indemnity", label: "Indemnity" },
    { id: "termination", label: "Termination" },
    { id: "confidentiality", label: "Confidentiality" },
    { id: "intellectual_property", label: "IP Rights" },
    { id: "governing_law", label: "Governing Law" },
  ];

  const filteredClauses = clauses.filter((clause) => {
    const matchCategory =
      filterCategory === "all" || clause.category === filterCategory;
    const matchSearch =
      !searchClause ||
      clause.title.toLowerCase().includes(searchClause.toLowerCase()) ||
      clause.text.toLowerCase().includes(searchClause.toLowerCase()) ||
      clause.summary?.toLowerCase().includes(searchClause.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="flex flex-col h-full bg-[#F7F7F5] p-6 overflow-y-auto">
      {/* Header and Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E4E1DA]">
        <div>
          <h3 className="text-base font-semibold text-[#171717] flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-[#B7791F]" />
            Key Contract Clauses & Obligations
          </h3>
          <p className="text-xs text-[#6B6B67] mt-0.5">
            Classified legal provisions with verified risk attribution.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-64">
          <Input
            placeholder="Search clauses..."
            value={searchClause}
            onChange={(e) => setSearchClause(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5 text-[#6B6B67]" />}
            className="h-8 text-xs bg-white border-[#E4E1DA]"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 py-3 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
              filterCategory === cat.id
                ? "bg-[#171717] text-white"
                : "bg-white text-[#6B6B67] hover:bg-[#F3E8D0]/40 border border-[#E4E1DA]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Clause Cards Grid */}
      <div className="grid grid-cols-1 gap-4 pt-2">
        {filteredClauses.length > 0 ? (
          filteredClauses.map((clause) => (
            <div
              key={clause.id}
              className="flex flex-col p-4 rounded-lg border border-[#E4E1DA] bg-white shadow-xs hover:border-[#B7791F]/40 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#171717]">
                    {clause.title}
                  </h4>
                  <span className="text-[11px] text-[#6B6B67] font-mono">
                    Pg {clause.pageNumber}
                  </span>
                </div>
                <RiskBadge level={clause.riskLevel} />
              </div>

              {clause.summary && (
                <p className="text-xs text-[#171717] leading-relaxed bg-[#F7F7F5] p-2.5 rounded-md border border-[#E4E1DA]">
                  <strong className="text-[#171717]">Legal Summary: </strong>
                  {clause.summary}
                </p>
              )}

              <blockquote className="text-xs text-[#6B6B67] italic border-l-2 border-[#B7791F]/40 pl-3 py-1 font-serif line-clamp-3">
                &quot;{clause.text}&quot;
              </blockquote>

              <div className="flex items-center justify-between pt-2 border-t border-[#E4E1DA]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#6B6B67]">
                  {clause.category.replace("_", " ")}
                </span>
                <Button
                  onClick={() => onSelectClause(clause.text)}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-[#B7791F] hover:text-[#B7791F]/80 hover:bg-[#F3E8D0]/30"
                  leftIcon={<Eye className="h-3.5 w-3.5" />}
                >
                  Locate in Text
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-[#6B6B67]">
            <ShieldAlert className="h-10 w-10 text-[#6B6B67]/40 mb-2" />
            <p className="text-xs font-semibold text-[#171717]">
              No clauses found in this category
            </p>
            <p className="text-[11px] text-[#6B6B67] mt-1">
              Select another filter or upload another contract.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
