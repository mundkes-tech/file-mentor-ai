"use client";

import React, { useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileWarning,
} from "lucide-react";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<any>;
}

type ModalProcessingStage = "idle" | "uploading" | "processing" | "ready" | "failed";

export function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ModalProcessingStage>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setErrorMessage(null);
    setProcessingStage("idle");
  };

  const handleClose = () => {
    if (processingStage !== "uploading" && processingStage !== "processing") {
      resetState();
      onClose();
    }
  };

  const validateFile = (file: File): boolean => {
    setErrorMessage(null);

    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage(
        "Unsupported file type. Please upload a PDF (.pdf) or Word document (.docx)."
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_LABEL}.`);
      return false;
    }

    if (file.size === 0) {
      setErrorMessage("The selected file is empty (0 bytes).");
      return false;
    }

    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setProcessingStage("uploading");
    setErrorMessage(null);

    // Step transition for feedback
    const processingTimer = setTimeout(() => {
      setProcessingStage("processing");
    }, 600);

    try {
      await onUpload(selectedFile);
      clearTimeout(processingTimer);
      setProcessingStage("ready");
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      clearTimeout(processingTimer);
      setProcessingStage("failed");
      setErrorMessage(err.message || "Failed to process document upload.");
    }
  };

  const isBusy = processingStage === "uploading" || processingStage === "processing";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Legal Contract"
      description="Upload contracts in PDF or DOCX format for extraction and analysis."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isBusy && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
            dragActive
              ? "border-[#B7791F] bg-[#F3E8D0]/30"
              : processingStage === "ready"
              ? "border-[#2F7D5A] bg-[#2F7D5A]/10"
              : processingStage === "failed"
              ? "border-[#B94A48] bg-[#B94A48]/10"
              : selectedFile
              ? "border-[#B7791F]/60 bg-[#F3E8D0]/20"
              : "border-[#E4E1DA] hover:border-[#B7791F]/60 bg-[#F7F7F5]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
            disabled={isBusy}
          />

          {processingStage === "ready" ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="h-12 w-12 text-[#2F7D5A] mb-2 animate-bounce" />
              <p className="text-sm font-semibold text-[#2F7D5A]">
                Processed & Ready
              </p>
              <p className="text-xs text-[#6B6B67] mt-0.5">
                Contract text extracted and indexed successfully.
              </p>
            </div>
          ) : processingStage === "processing" ? (
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-12 w-12 text-[#B7791F] mb-2 animate-spin" />
              <p className="text-sm font-semibold text-[#171717]">
                Processing Document...
              </p>
              <p className="text-xs text-[#6B6B67] mt-0.5">
                Extracting text, analyzing structure & indexing chunks...
              </p>
            </div>
          ) : processingStage === "uploading" ? (
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-12 w-12 text-[#B7791F] mb-2 animate-spin" />
              <p className="text-sm font-semibold text-[#171717]">
                Uploading File...
              </p>
              <p className="text-xs text-[#6B6B67] mt-0.5">
                Writing document to server storage...
              </p>
            </div>
          ) : processingStage === "failed" ? (
            <div className="flex flex-col items-center text-center">
              <FileWarning className="h-12 w-12 text-[#B94A48] mb-2" />
              <p className="text-sm font-semibold text-[#B94A48]">
                Processing Failed
              </p>
              <p className="text-xs text-[#6B6B67] mt-0.5">
                Click to choose another document.
              </p>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-xl bg-[#F3E8D0] text-[#B7791F] flex items-center justify-center mb-2">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold text-[#171717] truncate max-w-[280px]">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-[#6B6B67] mt-0.5">
                {formatBytes(selectedFile.size)} • Click to choose another file
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-xl bg-[#E4E1DA]/40 text-[#6B6B67] flex items-center justify-center mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold text-[#171717]">
                Click or drag & drop contract here
              </p>
              <p className="text-[11px] text-[#6B6B67] mt-1">
                Supports PDF (.pdf) and Word (.docx) up to {MAX_FILE_SIZE_LABEL}
              </p>
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#B94A48]/10 border border-[#B94A48]/30 text-[#B94A48] text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold block mb-0.5">Upload Error:</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E1DA]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isBusy}
          >
            {processingStage === "failed" ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedFile || isBusy || processingStage === "ready"}
            isLoading={isBusy}
          >
            {processingStage === "uploading"
              ? "Uploading..."
              : processingStage === "processing"
              ? "Processing..."
              : "Upload & Process"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
