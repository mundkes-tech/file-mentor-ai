export const APP_CONFIG = {
  name: "FileMentor AI",
  subtitle: "AI-powered document intelligence with verified sources",
  version: "0.1.0",
  description: "AI-powered document intelligence with verified sources",
};

export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED_FILE_TYPES);
export const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_SIZE_LABEL = "50 MB";

export const UPLOAD_DIR_NAME = "uploads";

export const CHUNK_CONFIG = {
  // Target character length for a single chunk (~200-250 words)
  targetChunkSize: parseInt(process.env.CHUNK_SIZE || "1200", 10),
  // Overlap in characters between adjacent chunks to preserve continuity
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || "200", 10),
  // Minimum chunk size to avoid meaningless fragments
  minChunkSize: 300,
  // Maximum chunk size when a single legal clause is large
  maxChunkSize: 2500,
};

export const RETRIEVAL_CONFIG = {
  // Number of candidate chunks to fetch during initial retrieval
  topK: parseInt(process.env.RETRIEVAL_TOP_K || "8", 10),
  // Maximum number of chunks to feed into LLM context window
  maxContextChunks: parseInt(process.env.MAX_CONTEXT_CHUNKS || "5", 10),
  // Maximum total context characters allowed for LLM prompt
  maxContextChars: parseInt(process.env.MAX_CONTEXT_CHARS || "20000", 10),
  // Minimum BM25/lexical score threshold to qualify as relevant
  minRelevanceScore: 0.15,
};

export const SAMPLE_SUGGESTED_PROMPTS = [
  "What are the termination conditions and notice periods?",
  "Does this agreement contain an uncapped indemnification clause?",
  "What is the governing law and designated jurisdiction?",
  "Are there any non-compete or non-solicitation restrictions?",
  "Summarize the intellectual property ownership terms.",
];

export const RISK_LEVEL_CONFIG = {
  low: {
    label: "Low Risk",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  medium: {
    label: "Medium Risk",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  high: {
    label: "High Risk",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    dotClass: "bg-orange-500",
  },
  critical: {
    label: "Critical Risk",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    dotClass: "bg-rose-500",
  },
};
