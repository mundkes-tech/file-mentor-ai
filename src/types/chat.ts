import { VerifiedQuote } from "./verification";

export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "sending" | "streaming" | "complete" | "stopped" | "error";

export interface CandidateQuote {
  text: string;
  documentId?: string;
}

export interface DocumentRetrievalSummary {
  documentId: string;
  documentName: string;
  retrievedCount: number;
  totalCount: number;
  isPartial: boolean;
}

export interface ChatMessage {
  id: string;
  documentId: string;
  documentIds?: string[];
  role: MessageRole;
  content: string;
  timestamp: string;
  status: MessageStatus;
  candidateQuotes?: CandidateQuote[];
  citations?: VerifiedQuote[]; // Preserved for forward compatibility with Phase 4
  retrievalMetadata?: {
    sectionsRetrieved?: number;
    totalSections?: number;
    isPartial?: boolean;
    strategy?: string;
    documents?: DocumentRetrievalSummary[];
  };
  error?: string;
}

export interface ChatSession {
  id: string;
  documentId: string;
  documentIds?: string[];
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
