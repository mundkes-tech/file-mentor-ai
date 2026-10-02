"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DocumentMetadata, ExtractedDocument, DocumentStatus } from "@/types";
import { apiClient } from "@/services/api-client";

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDocument, setActiveDocument] = useState<ExtractedDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingActiveDoc, setIsLoadingActiveDoc] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<DocumentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Select single document (resets multi-selection to this document)
  const selectDocument = useCallback((id: string) => {
    setSelectedIdState(id);
    setSelectedIds([id]);
  }, []);

  // Toggle document in multi-selection
  const toggleSelectDocument = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
        if (next.length > 0) {
          if (!next.includes(selectedId || "")) {
            setSelectedIdState(next[next.length - 1]);
          }
        } else {
          setSelectedIdState(null);
        }
        return next;
      });
    },
    [selectedId]
  );

  // Select all ready documents
  const selectAllDocuments = useCallback(() => {
    const readyDocIds = documents
      .filter((d) => d.status === "ready" || d.processingStatus === "ready")
      .map((d) => d.id);
    setSelectedIds(readyDocIds);
    if (readyDocIds.length > 0 && (!selectedId || !readyDocIds.includes(selectedId))) {
      setSelectedIdState(readyDocIds[0]);
    }
  }, [documents, selectedId]);

  // Clear multi-selection back to single active document
  const clearSelectedDocuments = useCallback(() => {
    if (selectedId) {
      setSelectedIds([selectedId]);
    } else {
      setSelectedIds([]);
    }
  }, [selectedId]);

  // Load document list from MongoDB API on mount
  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const docs = await apiClient.getDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !selectedId) {
        setSelectedIdState(docs[0].id);
        setSelectedIds([docs[0].id]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load contract library from database");
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load active document content when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setActiveDocument(null);
      return;
    }

    let isMounted = true;
    const fetchActiveDoc = async () => {
      setIsLoadingActiveDoc(true);
      setError(null);
      try {
        const fullDoc = await apiClient.getDocumentById(selectedId);
        if (isMounted) {
          setActiveDocument(fullDoc);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load document content");
        }
      } finally {
        if (isMounted) {
          setIsLoadingActiveDoc(false);
        }
      }
    };

    fetchActiveDoc();
    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  // Real upload and processing pipeline handler
  const uploadDocument = useCallback(
    async (file: File): Promise<DocumentMetadata> => {
      setUploadStatus("uploading");
      setError(null);

      try {
        setTimeout(() => {
          setUploadStatus((current) => (current === "uploading" ? "processing" : current));
        }, 500);

        const uploaded = await apiClient.uploadDocument(file);

        setUploadStatus("ready");
        setDocuments((prev) => [uploaded, ...prev.filter((d) => d.id !== uploaded.id)]);
        setSelectedIdState(uploaded.id);
        setSelectedIds([uploaded.id]);
        return uploaded;
      } catch (err: any) {
        setUploadStatus("failed");
        const errorMsg = err.message || "Failed to process document";
        setError(errorMsg);

        if (err.document) {
          const failedDoc = err.document as DocumentMetadata;
          setDocuments((prev) => [failedDoc, ...prev.filter((d) => d.id !== failedDoc.id)]);
          setSelectedIdState(failedDoc.id);
          setSelectedIds([failedDoc.id]);
        }

        throw new Error(errorMsg);
      } finally {
        setTimeout(() => {
          setUploadStatus(null);
        }, 2000);
      }
    },
    []
  );

  // Delete document handler
  const deleteDocument = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setSelectedIds((prev) => prev.filter((dId) => dId !== id));
        if (selectedId === id) {
          const remaining = documents.filter((d) => d.id !== id);
          setSelectedIdState(remaining.length > 0 ? remaining[0].id : null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to delete document");
      }
    },
    [documents, selectedId]
  );

  // Filtered documents according to search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.name.toLowerCase().includes(q) ||
        doc.originalFilename.toLowerCase().includes(q) ||
        doc.summary?.toLowerCase().includes(q) ||
        doc.parties?.some((p) => p.toLowerCase().includes(q))
    );
  }, [documents, searchQuery]);

  return {
    documents: filteredDocuments,
    allDocumentsCount: documents.length,
    selectedId,
    selectedIds,
    isMultiSelect: selectedIds.length > 1,
    activeDocument,
    isLoading,
    isLoadingActiveDoc,
    isUploading: uploadStatus === "uploading" || uploadStatus === "processing",
    uploadStatus,
    error,
    searchQuery,
    setSearchQuery,
    selectDocument,
    toggleSelectDocument,
    selectAllDocuments,
    clearSelectedDocuments,
    setSelectedIds,
    uploadDocument,
    deleteDocument,
    reloadDocuments: loadDocuments,
    setError,
  };
}
