import { NextRequest, NextResponse } from "next/server";
import { retrievalService } from "@/services/retrieval-service";
import { contextService } from "@/services/context-service";
import { chunkingService } from "@/services/chunking-service";
import { DocumentModel } from "@/models/Document";
import { connectToDatabase } from "@/lib/mongodb";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const question = searchParams.get("question") || searchParams.get("q");

    if (!documentId || !documentId.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "documentId query parameter is required." },
        { status: 400 }
      );
    }

    const cleanDocId = documentId.trim();

    if (!question || !question.trim()) {
      // If no question provided, return all chunks for inspection
      const chunks = await chunkingService.getChunksForDocument(cleanDocId);
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          documentId: cleanDocId,
          totalChunks: chunks.length,
          chunks,
        },
      });
    }

    const cleanQuestion = question.trim();

    // 1. Retrieve ranked chunks
    const retrieval = await retrievalService.retrieveRelevantChunks(
      cleanDocId,
      cleanQuestion,
      { includeBreakdown: true }
    );

    // 2. Build AI context
    const context = await contextService.getDocumentContext(
      cleanDocId,
      cleanQuestion
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        documentId: cleanDocId,
        question: cleanQuestion,
        totalChunksInDocument: retrieval.totalChunksInDocument,
        retrievedChunks: retrieval.retrievedChunks,
        maxScore: retrieval.maxScore,
        strategy: retrieval.strategy,
        context: {
          isPartialRetrieval: context.isPartialRetrieval,
          retrievedChunksCount: context.retrievedChunksCount,
          retrievalConfidence: context.retrievalConfidence,
          contextLengthChars: context.contextText.length,
          debugInfo: context.debugInfo,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Failed to retrieve chunks." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { documentId, action } = body;

    if (!documentId || typeof documentId !== "string" || !documentId.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "A valid documentId is required." },
        { status: 400 }
      );
    }

    const cleanDocId = documentId.trim();

    if (!cleanDocId || typeof cleanDocId !== "string" || cleanDocId.length > 100) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Document not found." },
        { status: 404 }
      );
    }

    if (action === "regenerate") {
      await connectToDatabase();
      const doc = await DocumentModel.findById(cleanDocId).lean();
      if (!doc) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Document not found." },
          { status: 404 }
        );
      }

      const chunks = await chunkingService.createAndStoreChunks(
        cleanDocId,
        doc.extractedText || "",
        doc.pages || [],
        doc.paragraphs || []
      );

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          documentId: cleanDocId,
          regeneratedChunksCount: chunks.length,
          chunks,
        },
      });
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: `Unsupported action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Failed to process retrieval request." },
      { status: 500 }
    );
  }
}
