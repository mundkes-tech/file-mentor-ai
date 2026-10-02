import { VerifiedQuote } from "./verification";

export type ComparisonStatus = "identical" | "modified" | "added" | "removed";

export type DifferenceType =
  | "identical"
  | "substantive_modification"
  | "only_in_doc_a"
  | "only_in_doc_b";

export interface ComparisonDocumentSide {
  documentId: string;
  documentName: string;
  sectionHeading?: string;
  pageNumber?: number;
  text: string;
  citation?: VerifiedQuote;
}

export interface ComparisonSection {
  id: string;
  title: string;
  category?: string;
  documentA: ComparisonDocumentSide;
  documentB: ComparisonDocumentSide;
  hasSubstantiveDifference: boolean;
  differenceType: DifferenceType;
  differenceSummary: string;
}

export interface ComparisonClauseDiff {
  clauseKey: string;
  title: string;
  docAContent?: string;
  docBContent?: string;
  status: ComparisonStatus;
  diffSummary?: string;
  riskChange?: "increased" | "decreased" | "unchanged";
}

export interface DocumentComparisonResult {
  id: string;
  baseDocumentId: string;
  targetDocumentId: string;
  baseDocumentName: string;
  targetDocumentName: string;
  documents: {
    id: string;
    name: string;
    originalFilename?: string;
    pageCount?: number;
  }[];
  comparedAt: string;
  overallSimilarityPercentage: number;
  summary: string;
  sections: ComparisonSection[];
  clauses?: ComparisonClauseDiff[]; // Backward compatibility with initial scaffolding
}
