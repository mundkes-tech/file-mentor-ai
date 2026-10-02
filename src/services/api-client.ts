import {
  ApiResponse,
  DocumentMetadata,
  ExtractedDocument,
  VerifiedQuote,
  DocumentComparisonResult,
} from "@/types";

/**
 * Client-side API service providing typed calls to Next.js API routes.
 */
export const apiClient = {
  async getDocuments(): Promise<DocumentMetadata[]> {
    const res = await fetch("/api/documents");
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to fetch documents: ${res.statusText}`);
    }
    const json: ApiResponse<DocumentMetadata[]> = await res.json();
    return json.data || [];
  },

  async getDocumentById(id: string): Promise<ExtractedDocument> {
    const res = await fetch(`/api/documents/${id}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to fetch document: ${res.statusText}`);
    }
    const json: ApiResponse<ExtractedDocument> = await res.json();
    if (!json.data) {
      throw new Error(json.error || "Document not found");
    }
    return json.data;
  },

  async uploadDocument(file: File): Promise<DocumentMetadata> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });

    const json: ApiResponse<DocumentMetadata> = await res.json().catch(() => ({
      success: false,
      error: `Upload failed with status ${res.status}`,
    }));

    if (!res.ok || !json.success) {
      const err: any = new Error(json.error || `Upload failed with status ${res.status}`);
      if (json.data) {
        err.document = json.data;
      }
      throw err;
    }

    if (!json.data) {
      throw new Error("Failed to parse uploaded document response");
    }
    return json.data;
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to delete document: ${res.statusText}`);
    }
  },

  async verifyQuote(documentId: string, quote: string, claimedPage?: number): Promise<VerifiedQuote> {
    const res = await fetch("/api/verify-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, quote, claimedPage }),
    });

    if (!res.ok) {
      throw new Error(`Quote verification failed: ${res.statusText}`);
    }

    const json: ApiResponse<VerifiedQuote> = await res.json();
    if (!json.data) {
      throw new Error("Invalid verification response");
    }
    return json.data;
  },

  async compareDocuments(baseId: string, targetId: string): Promise<DocumentComparisonResult> {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseId, targetId }),
    });

    if (!res.ok) {
      throw new Error(`Document comparison failed: ${res.statusText}`);
    }

    const json: ApiResponse<DocumentComparisonResult> = await res.json();
    if (!json.data) {
      throw new Error("Invalid comparison response");
    }
    return json.data;
  },
};
