import { DocumentMetadata, ExtractedDocument } from "@/types";
import { DocumentModel, IDocument } from "@/models/Document";
import { connectToDatabase } from "@/lib/mongodb";
import { extractorService } from "./extractor-service";
import mongoose from "mongoose";
import {
  ensureUploadsDirectory,
  generateStoredFileName,
  getStoredFilePath,
} from "@/lib/storage";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { chunkingService } from "./chunking-service";
import fs from "fs/promises";

function mapDocToMetadata(doc: any): DocumentMetadata {
  return {
    id: doc._id.toString(),
    name: doc.name,
    originalFilename: doc.originalFilename,
    fileType: doc.fileType,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    sizeBytes: doc.fileSize,
    storagePath: doc.storagePath,
    pageCount: doc.pageCount || 1,
    status: doc.processingStatus,
    processingStatus: doc.processingStatus,
    processingError: doc.processingError,
    statusMessage:
      doc.processingStatus === "ready"
        ? "Document processed and indexed"
        : doc.processingStatus === "failed"
        ? doc.processingError || "Processing failed"
        : "Processing document...",
    textLength: doc.textLength || 0,
    clauseCount: 0,
    summary: doc.summary || undefined,
    parties: doc.parties || [],
    effectiveDate: doc.effectiveDate,
    expirationDate: doc.expirationDate,
    uploadedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export const documentService = {
  /**
   * Retrieves all documents from MongoDB.
   */
  async getAllDocuments(): Promise<DocumentMetadata[]> {
    await connectToDatabase();
    const docs = await DocumentModel.find().sort({ createdAt: -1 }).lean();
    return docs.map(mapDocToMetadata);
  },

  /**
   * Retrieves full extracted document by ID from MongoDB.
   */
  async getDocumentById(id: string): Promise<ExtractedDocument | null> {
    if (!id || typeof id !== "string" || !id.trim() || id.length > 100) {
      return null;
    }
    await connectToDatabase();
    const doc = await DocumentModel.findById(id.trim()).lean();
    if (!doc) {
      return null;
    }

    const metadata = mapDocToMetadata(doc);

    return {
      metadata,
      fullText: doc.extractedText || "",
      pages: doc.pages || [],
      paragraphs: doc.paragraphs || [],
      clauses: [],
    };
  },

  /**
   * Complete pipeline:
   * 1. Validate file (type & size)
   * 2. Save original file to uploads/
   * 3. Create document record with status = 'processing'
   * 4. Extract PDF/DOCX text
   * 5. Validate text & detect scanned PDF
   * 6. Store extracted text + page metadata
   * 7. Set status = 'ready' (or 'failed' on failure)
   */
  async processUploadedFile(file: File): Promise<DocumentMetadata> {
    await connectToDatabase();

    // 1. Validation
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isDocx = lowerName.endsWith(".docx");

    if (!isPdf && !isDocx) {
      throw new Error(
        "Unsupported file type. Please upload a PDF (.pdf) or Word document (.docx)."
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("File exceeds maximum allowed size of 50 MB.");
    }

    if (file.size === 0) {
      throw new Error("The uploaded file is empty (0 bytes).");
    }

    // 2. Save original file safely to uploads/
    await ensureUploadsDirectory();
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const storedFileName = generateStoredFileName(file.name, docId);
    const destinationPath = getStoredFilePath(storedFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(destinationPath, buffer);

    const fileType = isPdf ? "pdf" : "docx";
    const mimeType =
      file.type ||
      (isPdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    // 3. Create database document record with status = 'processing'
    const docRecord = await DocumentModel.create({
      _id: docId,
      originalFilename: file.name,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileType,
      mimeType,
      fileSize: file.size,
      storagePath: destinationPath,
      processingStatus: "processing",
      extractedText: "",
      textLength: 0,
      pageCount: 0,
      pages: [],
      paragraphs: [],
    });

    // 4 & 5. Extract text & validate readability
    try {
      const extraction = isPdf
        ? await extractorService.extractPdf(buffer)
        : await extractorService.extractDocx(buffer);

      // 6. Generate and store structure-aware chunks in MongoDB
      await chunkingService.createAndStoreChunks(
        docId,
        extraction.fullText,
        extraction.pages,
        extraction.paragraphs
      );

      // 7. Store extracted text and set status = 'ready'
      docRecord.extractedText = extraction.fullText;
      docRecord.textLength = extraction.textLength;
      docRecord.pageCount = extraction.pageCount;
      docRecord.pages = extraction.pages;
      docRecord.paragraphs = extraction.paragraphs;
      docRecord.processingStatus = "ready";
      docRecord.processingError = undefined;
      await docRecord.save();

      return mapDocToMetadata(docRecord);
    } catch (err: any) {
      // Set status = 'failed' and record processing error
      const errorMsg = err.message || "Failed to extract text from document";
      docRecord.processingStatus = "failed";
      docRecord.processingError = errorMsg;
      await docRecord.save();

      const failedMeta = mapDocToMetadata(docRecord);
      const enhancedError: any = new Error(errorMsg);
      enhancedError.document = failedMeta;
      throw enhancedError;
    }
  },

  /**
   * Deletes the database record and associated physical file gracefully.
   */
  async deleteDocument(id: string): Promise<boolean> {
    if (!id || typeof id !== "string" || !id.trim() || id.length > 100) {
      return false;
    }
    await connectToDatabase();
    const doc = await DocumentModel.findById(id.trim());
    if (!doc) {
      return false;
    }

    // Safely remove file on disk
    if (doc.storagePath) {
      try {
        await fs.unlink(doc.storagePath);
      } catch {
        // Missing or already deleted file handled gracefully
      }
    }

    await DocumentModel.findByIdAndDelete(id);

    // Clean up associated chunks so no orphaned records remain in MongoDB
    try {
      await chunkingService.deleteChunksForDocument(id);
    } catch {
      // Ignore if chunk cleanup fails
    }

    // Clean up associated chat history so no orphaned records remain
    try {
      const { ChatSessionModel } = await import("@/models/ChatSession");
      await ChatSessionModel.deleteOne({ documentId: id });
    } catch {
      // Ignore if chat session model cleanup fails
    }

    return true;
  },
};
