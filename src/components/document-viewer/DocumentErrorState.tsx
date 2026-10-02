"use client";

import React from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DocumentErrorStateProps {
  error: string;
  onRetry?: () => void;
  onReset?: () => void;
}

export function DocumentErrorState({
  error,
  onRetry,
  onReset,
}: DocumentErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/50 dark:bg-slate-950/30">
      <div className="max-w-md flex flex-col items-center p-6 rounded-2xl bg-white border border-rose-200 shadow-sm dark:bg-slate-900 dark:border-rose-950">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 mb-4">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Document Retrieval Error
        </h3>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-mono bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/50 w-full break-words">
          {error}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
          The requested contract could not be indexed or retrieved from local storage.
        </p>

        <div className="flex items-center gap-3 mt-6">
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Retry
            </Button>
          )}
          {onReset && (
            <Button
              onClick={onReset}
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
            >
              Back to Library
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
