import mongoose, { Schema } from "mongoose";

export interface IDocumentChunk {
  _id: string; // e.g. "chk_docId_chunkIndex"
  documentId: string;
  chunkIndex: number;
  text: string;
  pageStart: number;
  pageEnd: number;
  startOffset: number;
  endOffset: number;
  sectionHeading?: string;
  tokenCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    _id: { type: String, required: true },
    documentId: { type: String, required: true, index: true },
    chunkIndex: { type: Number, required: true, index: true },
    text: { type: String, required: true },
    pageStart: { type: Number, required: true },
    pageEnd: { type: Number, required: true },
    startOffset: { type: Number, required: true },
    endOffset: { type: Number, required: true },
    sectionHeading: { type: String },
    tokenCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Compound index to guarantee uniqueness of chunk index per document and enable fast retrieval
DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

// Prevent re-compilation of model in Next.js development HMR
export const DocumentChunkModel =
  (mongoose.models.DocumentChunk as mongoose.Model<IDocumentChunk>) ||
  mongoose.model<IDocumentChunk>("DocumentChunk", DocumentChunkSchema);
