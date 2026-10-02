import { DocumentMetadata, ExtractedDocument } from "./document";
import { VerifiedQuote } from "./verification";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DocumentUploadResponse {
  document: DocumentMetadata;
}

export interface DocumentDetailResponse {
  document: ExtractedDocument;
}

export interface ChatStreamEvent {
  type: "token" | "done" | "citation" | "error";
  content?: string;
  citation?: VerifiedQuote;
  error?: string;
}
