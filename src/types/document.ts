export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ClauseCategory =
  | "indemnity"
  | "liability"
  | "termination"
  | "confidentiality"
  | "governing_law"
  | "intellectual_property"
  | "payment"
  | "warranty"
  | "other";

export interface DocumentClause {
  id: string;
  title: string;
  category: ClauseCategory;
  text: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  riskLevel: RiskLevel;
  summary?: string;
}

export interface DocumentPage {
  pageNumber: number;
  text: string;
  textLength: number;
  startOffset?: number;
  endOffset?: number;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  originalFilename: string;
  fileType?: "pdf" | "docx";
  mimeType: string;
  fileSize?: number;
  sizeBytes: number; // Alias for backward compatibility in UI
  storagePath?: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
  cloudinaryFormat?: string;
  cloudinarySecureUrl?: string;
  pageCount: number;
  status: DocumentStatus;
  processingStatus?: DocumentStatus;
  processingError?: string;
  statusMessage?: string;
  textLength?: number;
  clauseCount?: number;
  summary?: string;
  parties?: string[];
  effectiveDate?: string;
  expirationDate?: string;
  uploadedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentChunk {
  id: string;
  chunkId?: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  pageNumber: number; // for backward compatibility, same as pageStart
  pageStart: number;
  pageEnd: number;
  startOffset: number;
  endOffset: number;
  sectionHeading?: string;
  tokenCount?: number;
  createdAt?: string | Date;
}

export interface ExtractedDocument {
  metadata: DocumentMetadata;
  fullText: string;
  pages?: DocumentPage[];
  paragraphs?: string[];
  clauses: DocumentClause[];
  chunks?: DocumentChunk[];
}
