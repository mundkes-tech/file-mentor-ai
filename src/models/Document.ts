import mongoose, { Schema } from "mongoose";

export interface IDocumentPage {
  pageNumber: number;
  text: string;
  textLength: number;
  startOffset?: number;
  endOffset?: number;
}

export interface IDocument {
  _id: string;
  originalFilename: string;
  name: string;
  fileType: "pdf" | "docx";
  mimeType: string;
  fileSize: number;
  storagePath?: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
  cloudinaryFormat?: string;
  cloudinarySecureUrl?: string;
  processingStatus: "uploading" | "processing" | "ready" | "failed";
  processingError?: string;
  extractedText: string;
  textLength: number;
  pageCount: number;
  pages: IDocumentPage[];
  paragraphs: string[];
  summary?: string;
  parties?: string[];
  effectiveDate?: string;
  expirationDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentPageSchema = new Schema<IDocumentPage>(
  {
    pageNumber: { type: Number, required: true },
    text: { type: String, default: "" },
    textLength: { type: Number, default: 0 },
    startOffset: { type: Number, default: 0 },
    endOffset: { type: Number, default: 0 },
  },
  { _id: false }
);

const DocumentSchema = new Schema<IDocument>(
  {
    _id: { type: String, required: true },
    originalFilename: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    fileType: { type: String, enum: ["pdf", "docx"], required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    storagePath: { type: String, required: false, default: "" },
    cloudinaryPublicId: { type: String, index: true },
    cloudinaryResourceType: { type: String, default: "raw" },
    cloudinaryFormat: { type: String },
    cloudinarySecureUrl: { type: String },
    processingStatus: {
      type: String,
      enum: ["uploading", "processing", "ready", "failed"],
      default: "uploading",
      index: true,
    },
    processingError: { type: String },
    extractedText: { type: String, default: "" },
    textLength: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    pages: { type: [DocumentPageSchema], default: [] },
    paragraphs: { type: [String], default: [] },
    summary: { type: String },
    parties: { type: [String], default: [] },
    effectiveDate: { type: String },
    expirationDate: { type: String },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Prevent re-compilation of model in Next.js development HMR
export const DocumentModel =
  (mongoose.models.Document as mongoose.Model<IDocument>) ||
  mongoose.model<IDocument>("Document", DocumentSchema);
