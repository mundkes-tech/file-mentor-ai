import { DocumentModel } from "@/models/Document";
import { connectToDatabase } from "@/lib/mongodb";
import { retrievalService, RetrievedChunk } from "./retrieval-service";
import { chunkingService } from "./chunking-service";
import { RETRIEVAL_CONFIG } from "@/lib/constants";
import mongoose from "mongoose";

export interface DocumentContext {
  documentId: string;
  documentName: string;
  originalFilename: string;
  fileType: string;
  pageCount: number;
  contextText: string;
  isTruncated: boolean;
  isPartialRetrieval: boolean;
  totalChunksInDocument: number;
  retrievedChunksCount: number;
  retrievalConfidence: "high" | "medium" | "low" | "none";
  retrievedChunks: RetrievedChunk[];
  debugInfo?: {
    query: string;
    totalChunks: number;
    retrievedCount: number;
    selectedCount: number;
    maxScore: number;
    selectedIndices: number[];
  };
}

export const contextService = {
  /**
   * Retrieves relevant context for a specific document to supply to the AI model.
   * Uses lexical chunk retrieval and controlled context budgeting instead of sending
   * the full document text, enabling seamless scaling to 150+ page contracts.
   */
  async getDocumentContext(
    documentId: string,
    userQuestion: string
  ): Promise<DocumentContext> {
    await connectToDatabase();

    const cleanDocId = (documentId || "").trim();
    if (!cleanDocId || typeof cleanDocId !== "string" || cleanDocId.length > 100) {
      throw new Error("The specified document could not be found.");
    }
    const doc = await DocumentModel.findById(cleanDocId).lean();
    if (!doc) {
      throw new Error("The specified document could not be found.");
    }

    if (doc.processingStatus !== "ready") {
      throw new Error(
        doc.processingStatus === "failed"
          ? `Cannot query document: ${doc.processingError || "Processing failed."}`
          : "Document is still processing. Please wait until it is ready."
      );
    }

    if (!doc.extractedText || doc.extractedText.trim().length === 0) {
      throw new Error(
        "No extracted text found in this document. Please re-upload the document."
      );
    }

    // 1. Ensure chunks exist in MongoDB for this document
    await chunkingService.ensureChunksForDocument(cleanDocId);

    // 2. Retrieve relevant chunks strictly for this document
    const retrievalResult = await retrievalService.retrieveRelevantChunks(
      cleanDocId,
      userQuestion,
      {
        topK: RETRIEVAL_CONFIG.topK,
        minScore: RETRIEVAL_CONFIG.minRelevanceScore,
        includeBreakdown: true,
      }
    );

    const totalChunksInDoc = retrievalResult.totalChunksInDocument;
    const rankedChunks = retrievalResult.retrievedChunks;
    const maxScore = retrievalResult.maxScore;

    // 3. Select best chunks within context budget
    const maxContextChunks = RETRIEVAL_CONFIG.maxContextChunks;
    const maxContextChars = RETRIEVAL_CONFIG.maxContextChars;

    let selectedChunks: RetrievedChunk[] = [];
    let isPartialRetrieval = false;

    // Case A: Small document (total chunks <= maxContextChunks)
    // If the entire document fits within the budget, include all chunks to provide complete visibility
    if (totalChunksInDoc > 0 && totalChunksInDoc <= maxContextChunks) {
      const allChunks = await chunkingService.getChunksForDocument(cleanDocId);
      selectedChunks = allChunks.map((c) => ({
        ...c,
        score: rankedChunks.find((r) => r.chunkIndex === c.chunkIndex)?.score || 0,
      }));
      isPartialRetrieval = false;
    } else {
      // Case B: Large document (150-page contracts, large agreements)
      // Strictly select top ranked relevant chunks within budget
      isPartialRetrieval = true;

      let currentChars = 0;
      for (const chunk of rankedChunks) {
        if (selectedChunks.length >= maxContextChunks) {
          break;
        }
        if (currentChars + chunk.text.length > maxContextChars && selectedChunks.length > 0) {
          break;
        }
        selectedChunks.push(chunk);
        currentChars += chunk.text.length;
      }

      // Re-order selected chunks by natural chunkIndex so they appear in document sequence
      selectedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    }

    // 4. Assess retrieval confidence
    let retrievalConfidence: "high" | "medium" | "low" | "none" = "none";
    if (selectedChunks.length > 0) {
      if (maxScore >= 6.0) {
        retrievalConfidence = "high";
      } else if (maxScore >= 2.0) {
        retrievalConfidence = "medium";
      } else {
        retrievalConfidence = "low";
      }
    }

    // 5. Format selected chunks for AI context
    let contextText = "";
    if (selectedChunks.length === 0) {
      contextText =
        "[NO MATCHING SECTIONS: Lexical search found no sections in the contract matching the query terms.]";
    } else {
      const sections = selectedChunks.map((chunk, idx) => {
        const pageLabel =
          chunk.pageStart === chunk.pageEnd
            ? `Page ${chunk.pageStart}`
            : `Pages ${chunk.pageStart}–${chunk.pageEnd}`;
        const headingLabel = chunk.sectionHeading
          ? ` | Heading: ${chunk.sectionHeading}`
          : "";

        return `--- [SECTION ${idx + 1} OF ${selectedChunks.length} | Document ${pageLabel}${headingLabel}] ---\n${chunk.text}`;
      });

      contextText = sections.join("\n\n");
    }

    // 6. Debug information for development inspection
    const debugInfo = {
      query: userQuestion,
      totalChunks: totalChunksInDoc,
      retrievedCount: rankedChunks.length,
      selectedCount: selectedChunks.length,
      maxScore,
      selectedIndices: selectedChunks.map((c) => c.chunkIndex),
    };

    if (process.env.NODE_ENV === "development" || process.env.DEBUG_RETRIEVAL === "true") {
      console.log(
        `[ContextService] Doc: "${doc.name}" | Query: "${userQuestion}" | Selected: ${selectedChunks.length}/${totalChunksInDoc} chunks | Coverage: ${isPartialRetrieval ? "PARTIAL" : "COMPLETE"} | ContextChars: ${contextText.length}`
      );
    }

    return {
      documentId: doc._id,
      documentName: doc.name,
      originalFilename: doc.originalFilename,
      fileType: doc.fileType,
      pageCount: doc.pageCount,
      contextText,
      isTruncated: isPartialRetrieval,
      isPartialRetrieval,
      totalChunksInDocument: totalChunksInDoc,
      retrievedChunksCount: selectedChunks.length,
      retrievalConfidence,
      retrievedChunks: selectedChunks,
      debugInfo,
    };
  },

  /**
   * Retrieves relevant context independently from multiple selected documents,
   * strictly preserving document isolation and enforcing a global context budget.
   */
  async getMultiDocumentContext(
    documentIds: string[],
    userQuestion: string
  ): Promise<MultiDocumentContext> {
    await connectToDatabase();

    const cleanIds = Array.from(new Set(documentIds.map((id) => id.trim()))).filter(Boolean);
    if (cleanIds.length === 0) {
      throw new Error("At least one valid documentId must be provided.");
    }

    // Single document optimization
    if (cleanIds.length === 1) {
      const single = await this.getDocumentContext(cleanIds[0], userQuestion);
      return {
        documents: [
          {
            documentId: single.documentId,
            documentName: single.documentName,
            originalFilename: single.originalFilename,
            fileType: single.fileType,
            pageCount: single.pageCount,
            isPartialRetrieval: single.isPartialRetrieval,
            totalChunksInDocument: single.totalChunksInDocument,
            retrievedChunksCount: single.retrievedChunksCount,
            retrievalConfidence: single.retrievalConfidence,
            retrievedChunks: single.retrievedChunks,
          },
        ],
        contextText: `===== DOCUMENT: ${single.documentName} (ID: ${single.documentId}) =====\n${single.contextText}`,
        isPartialRetrieval: single.isPartialRetrieval,
        totalChunksAcrossDocs: single.totalChunksInDocument,
        totalRetrievedChunks: single.retrievedChunksCount,
      };
    }

    // 1. Fetch and validate all documents
    const docs = await DocumentModel.find({ _id: { $in: cleanIds } }).lean();
    if (docs.length !== cleanIds.length) {
      const foundIds = new Set(docs.map((d) => d._id.toString()));
      const missing = cleanIds.filter((id) => !foundIds.has(id));
      throw new Error(`One or more specified documents could not be found: ${missing.join(", ")}`);
    }

    for (const doc of docs) {
      if (doc.processingStatus !== "ready") {
        throw new Error(
          doc.processingStatus === "failed"
            ? `Cannot query "${doc.name}": ${doc.processingError || "Processing failed."}`
            : `Document "${doc.name}" is still processing. Please wait until all selected contracts are ready.`
        );
      }
      if (!doc.extractedText || doc.extractedText.trim().length === 0) {
        throw new Error(`No extracted text found in "${doc.name}". Please re-upload.`);
      }
    }

    // 2. Ensure chunks exist in parallel for all selected documents
    await Promise.all(cleanIds.map((id) => chunkingService.ensureChunksForDocument(id)));

    // 3. Document-isolated retrieval & budgeting
    // Total budget: 25,000 characters; allocate per-document chunks deterministically
    const maxGlobalChars = RETRIEVAL_CONFIG.maxContextChars;
    const perDocMaxChunks = Math.max(
      2,
      Math.floor(RETRIEVAL_CONFIG.maxContextChunks / cleanIds.length)
    );

    const docContextResults: MultiDocumentContext["documents"] = [];
    const docContextSections: string[] = [];
    let cumulativeChars = 0;
    let anyDocIsPartial = false;
    let totalChunksAcrossDocs = 0;
    let totalRetrievedChunks = 0;

    for (const doc of docs) {
      const docId = doc._id.toString();

      // Retrieve strictly scoped chunks for this specific document
      const retrievalResult = await retrievalService.retrieveRelevantChunks(
        docId,
        userQuestion,
        {
          topK: perDocMaxChunks * 2,
          minScore: RETRIEVAL_CONFIG.minRelevanceScore,
          includeBreakdown: true,
        }
      );

      const totalChunksInDoc = retrievalResult.totalChunksInDocument;
      totalChunksAcrossDocs += totalChunksInDoc;
      const rankedChunks = retrievalResult.retrievedChunks;
      const maxScore = retrievalResult.maxScore;

      let selectedChunks: RetrievedChunk[] = [];
      let isPartial = false;

      if (totalChunksInDoc > 0 && totalChunksInDoc <= perDocMaxChunks) {
        // Small document fits completely within per-document allocation
        const allChunks = await chunkingService.getChunksForDocument(docId);
        selectedChunks = allChunks.map((c) => ({
          ...c,
          score: rankedChunks.find((r) => r.chunkIndex === c.chunkIndex)?.score || 0,
        }));
        isPartial = false;
      } else {
        // Large document: select top ranked chunks within budget
        isPartial = true;
        anyDocIsPartial = true;

        for (const chunk of rankedChunks) {
          if (selectedChunks.length >= perDocMaxChunks) break;
          if (cumulativeChars + chunk.text.length > maxGlobalChars && selectedChunks.length > 0) {
            break;
          }
          selectedChunks.push(chunk);
          cumulativeChars += chunk.text.length;
        }

        selectedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      }

      totalRetrievedChunks += selectedChunks.length;

      let confidence: "high" | "medium" | "low" | "none" = "none";
      if (selectedChunks.length > 0) {
        confidence = maxScore >= 6.0 ? "high" : maxScore >= 2.0 ? "medium" : "low";
      }

      docContextResults.push({
        documentId: docId,
        documentName: doc.name,
        originalFilename: doc.originalFilename,
        fileType: doc.fileType,
        pageCount: doc.pageCount,
        isPartialRetrieval: isPartial,
        totalChunksInDocument: totalChunksInDoc,
        retrievedChunksCount: selectedChunks.length,
        retrievalConfidence: confidence,
        retrievedChunks: selectedChunks,
      });

      // Format document context block with clear boundary & coverage metadata
      const coverageLabel = isPartial
        ? `[Coverage: PARTIAL (${selectedChunks.length} of ${totalChunksInDoc} sections examined)]`
        : `[Coverage: COMPLETE (Full document examined)]`;

      let docBlock = `===== DOCUMENT: ${doc.name} (ID: ${docId}) =====\n${coverageLabel}\n`;
      if (selectedChunks.length === 0) {
        docBlock += `[NO MATCHING SECTIONS: Lexical search found no sections in "${doc.name}" matching the query terms.]`;
      } else {
        const sections = selectedChunks.map((chunk, idx) => {
          const pageLabel =
            chunk.pageStart === chunk.pageEnd
              ? `Page ${chunk.pageStart}`
              : `Pages ${chunk.pageStart}–${chunk.pageEnd}`;
          const headingLabel = chunk.sectionHeading ? ` | Heading: ${chunk.sectionHeading}` : "";
          return `--- [SECTION ${idx + 1} OF ${selectedChunks.length} | Document: ${doc.name} | ${pageLabel}${headingLabel}] ---\n${chunk.text}`;
        });
        docBlock += sections.join("\n\n");
      }

      docContextSections.push(docBlock);
    }

    return {
      documents: docContextResults,
      contextText: docContextSections.join("\n\n\n"),
      isPartialRetrieval: anyDocIsPartial,
      totalChunksAcrossDocs,
      totalRetrievedChunks,
    };
  },
};

export interface MultiDocumentContext {
  documents: {
    documentId: string;
    documentName: string;
    originalFilename: string;
    fileType: string;
    pageCount: number;
    isPartialRetrieval: boolean;
    totalChunksInDocument: number;
    retrievedChunksCount: number;
    retrievalConfidence: "high" | "medium" | "low" | "none";
    retrievedChunks: RetrievedChunk[];
  }[];
  contextText: string;
  isPartialRetrieval: boolean;
  totalChunksAcrossDocs: number;
  totalRetrievedChunks: number;
}
