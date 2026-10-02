"use client";

import React, { useState } from "react";
import { DocumentMetadata } from "@/types";
import { RedlineSummary } from "@/services/redline-service";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  X,
  FileEdit,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Plus,
  Minus,
  Sparkles,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface ContractRedlineModalProps {
  isOpen: boolean;
  documents: DocumentMetadata[];
  defaultOriginalId?: string | null;
  defaultUpdatedId?: string | null;
  onClose: () => void;
}

export function ContractRedlineModal({
  isOpen,
  documents,
  defaultOriginalId,
  defaultUpdatedId,
  onClose,
}: ContractRedlineModalProps) {
  const docxDocuments = documents.filter(
    (d) =>
      d.fileType === "docx" ||
      d.originalFilename.toLowerCase().endsWith(".docx")
  );

  const [origDocId, setOrigDocId] = useState<string>(
    defaultOriginalId || (docxDocuments[0]?.id || "")
  );
  const [updDocId, setUpdDocId] = useState<string>(
    defaultUpdatedId || (docxDocuments[1]?.id || docxDocuments[0]?.id || "")
  );

  const [origFile, setOrigFile] = useState<File | null>(null);
  const [updFile, setUpdFile] = useState<File | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RedlineSummary | null>(null);
  const [downloadBase64, setDownloadBase64] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>("Redline_Contract.docx");

  if (!isOpen) return null;

  const handleGenerateRedline = async () => {
    setIsProcessing(true);
    setError(null);
    setSummary(null);
    setDownloadBase64(null);

    try {
      const formData = new FormData();

      if (origFile) {
        formData.append("originalFile", origFile);
      } else if (origDocId) {
        formData.append("originalDocId", origDocId);
      } else {
        throw new Error("Please select or upload an original DOCX contract.");
      }

      if (updFile) {
        formData.append("updatedFile", updFile);
      } else if (updDocId) {
        formData.append("updatedDocId", updDocId);
      } else {
        throw new Error("Please select or upload an updated DOCX contract.");
      }

      const res = await fetch("/api/redline", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Redlining failed (${res.status})`);
      }

      setSummary(json.data.summary);
      setDownloadBase64(json.data.base64);
      setDownloadFilename(json.data.filename);
    } catch (err: any) {
      setError(err.message || "Failed to generate contract redline.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!downloadBase64) return;
    const byteCharacters = atob(downloadBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/60 backdrop-blur-xs">
      <div
        className="relative flex flex-col w-full max-w-2xl rounded-xl bg-white border border-[#E4E1DA] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E1DA] bg-[#F7F7F5]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3E8D0] text-[#B7791F] border border-[#E4E1DA]">
              <FileEdit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#171717] tracking-tight">
                Tracked-Change Contract Redliner
              </h2>
              <p className="text-xs text-[#6B6B67]">
                Generate an authoritative DOCX document showing tracked revisions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#6B6B67] hover:text-[#171717] hover:bg-[#E4E1DA]/40 transition-colors cursor-pointer"
            aria-label="Close redline modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workflow Banner */}
        <div className="px-6 py-2.5 bg-[#F3E8D0]/30 border-b border-[#E4E1DA] text-[11px] text-[#6B6B67] flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-semibold text-[#171717]">Workflow:</span>
            <span>Original Contract</span>
            <span className="text-[#B7791F] font-bold">+</span>
            <span>Updated Contract</span>
            <span className="text-[#B7791F] font-bold">→</span>
            <span className="text-[#B7791F] font-semibold">Generate Redline</span>
          </div>
          <span className="text-[10px] text-[#6B6B67]">DOCX Only</span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto bg-white">
          {/* File Selection Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Document */}
            <div className="p-4 rounded-lg border border-[#E4E1DA] bg-[#F7F7F5] space-y-3">
              <label className="text-xs font-semibold text-[#171717] flex items-center gap-1.5 uppercase tracking-wider">
                <Minus className="h-3.5 w-3.5 text-[#B94A48]" />
                Original Contract (Base)
              </label>

              {docxDocuments.length > 0 && !origFile && (
                <div>
                  <label className="text-[11px] text-[#6B6B67] block mb-1">From Library:</label>
                  <select
                    value={origDocId}
                    onChange={(e) => setOrigDocId(e.target.value)}
                    className="w-full text-xs p-2 rounded-md border border-[#E4E1DA] bg-white text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#B7791F]"
                  >
                    {docxDocuments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.originalFilename})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] text-[#6B6B67] block mb-1">Or Upload DOCX:</label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setOrigFile(e.target.files?.[0] || null)}
                  className="text-xs text-[#6B6B67] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-[#E4E1DA] file:text-xs file:bg-white file:text-[#171717] hover:file:bg-[#F3E8D0] file:cursor-pointer"
                />
                {origFile && (
                  <p className="text-[11px] text-[#2F7D5A] mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Selected: {origFile.name}
                  </p>
                )}
              </div>
            </div>

            {/* Updated Document */}
            <div className="p-4 rounded-lg border border-[#E4E1DA] bg-[#F7F7F5] space-y-3">
              <label className="text-xs font-semibold text-[#171717] flex items-center gap-1.5 uppercase tracking-wider">
                <Plus className="h-3.5 w-3.5 text-[#2F7D5A]" />
                Updated Contract (Revision)
              </label>

              {docxDocuments.length > 0 && !updFile && (
                <div>
                  <label className="text-[11px] text-[#6B6B67] block mb-1">From Library:</label>
                  <select
                    value={updDocId}
                    onChange={(e) => setUpdDocId(e.target.value)}
                    className="w-full text-xs p-2 rounded-md border border-[#E4E1DA] bg-white text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#B7791F]"
                  >
                    {docxDocuments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.originalFilename})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] text-[#6B6B67] block mb-1">Or Upload DOCX:</label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setUpdFile(e.target.files?.[0] || null)}
                  className="text-xs text-[#6B6B67] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-[#E4E1DA] file:text-xs file:bg-white file:text-[#171717] hover:file:bg-[#F3E8D0] file:cursor-pointer"
                />
                {updFile && (
                  <p className="text-[11px] text-[#2F7D5A] mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Selected: {updFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Processing State Indicator */}
          {isProcessing && (
            <div className="p-4 rounded-lg border border-[#E4E1DA] bg-[#F3E8D0]/30 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[#B7791F] shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#171717]">Comparing contract structures...</p>
                <p className="text-[11px] text-[#6B6B67]">Aligning clauses, computing token diffs, and embedding Word XML tracked changes.</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-lg border border-[#B94A48]/30 bg-[#B94A48]/10 text-xs text-[#B94A48]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#B94A48]" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Summary Banner */}
          {summary && (
            <div className="p-4 rounded-lg border border-[#2F7D5A]/30 bg-[#2F7D5A]/5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2F7D5A]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Redline Generated Successfully</span>
                </div>
                <Badge variant="outline" className="bg-[#2F7D5A]/10 text-[#2F7D5A] border-[#2F7D5A]/30 text-xs font-semibold">
                  {summary.totalChanges} Total Changes
                </Badge>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-xs text-center pt-1">
                <div className="p-2.5 rounded-md bg-white border border-[#E4E1DA]">
                  <div className="text-base font-bold text-[#2F7D5A]">+{summary.additionsCount}</div>
                  <div className="text-[10px] text-[#6B6B67] uppercase tracking-wider mt-0.5">Additions</div>
                </div>
                <div className="p-2.5 rounded-md bg-white border border-[#E4E1DA]">
                  <div className="text-base font-bold text-[#B94A48]">-{summary.deletionsCount}</div>
                  <div className="text-[10px] text-[#6B6B67] uppercase tracking-wider mt-0.5">Deletions</div>
                </div>
                <div className="p-2.5 rounded-md bg-white border border-[#E4E1DA]">
                  <div className="text-base font-bold text-[#B7791F]">{summary.modifiedSectionsCount}</div>
                  <div className="text-[10px] text-[#6B6B67] uppercase tracking-wider mt-0.5">Modified Sections</div>
                </div>
              </div>

              {/* Key Changes List */}
              {summary.keySubstantiveChanges.length > 0 && (
                <div className="text-[11px] text-[#171717] space-y-1.5 pt-2 border-t border-[#E4E1DA]">
                  <span className="font-semibold text-xs text-[#171717]">Substantive Modifications Summary:</span>
                  <ul className="list-disc pl-4 space-y-1 font-mono text-[10px] text-[#6B6B67]">
                    {summary.keySubstantiveChanges.slice(0, 4).map((ch, idx) => (
                      <li key={idx} className="truncate">{ch}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E4E1DA] bg-[#F7F7F5]">
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>

          <div className="flex items-center gap-2">
            {summary && downloadBase64 && (
              <Button
                onClick={handleDownload}
                size="sm"
                className="bg-[#2F7D5A] hover:bg-[#2F7D5A]/90 text-white font-medium shadow-xs"
                leftIcon={<Download className="h-4 w-4" />}
              >
                Download Redlined DOCX
              </Button>
            )}

            <Button
              onClick={handleGenerateRedline}
              disabled={isProcessing}
              size="sm"
              className="bg-[#B7791F] hover:bg-[#B7791F]/90 text-white font-medium shadow-xs disabled:opacity-50"
              leftIcon={
                isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )
              }
            >
              {isProcessing ? "Processing Redline..." : "Generate Redline"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
