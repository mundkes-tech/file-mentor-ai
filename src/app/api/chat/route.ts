import { NextRequest, NextResponse } from "next/server";
import { chatService, getSessionKey } from "@/services/chat-service";
import { contextService, DocumentContext, MultiDocumentContext } from "@/services/context-service";
import { aiService, AiChatMessage } from "@/services/ai-service";
import { quoteVerificationService } from "@/services/quote-verification-service";
import { ApiResponse, ChatMessage, VerifiedQuote } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const documentIdsParam = searchParams.get("documentIds");

    let targetDocIds: string[] = [];
    if (documentIdsParam) {
      targetDocIds = documentIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (documentId && documentId.trim()) {
      targetDocIds = [documentId.trim()];
    }

    if (targetDocIds.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "documentId or documentIds query parameter is required." },
        { status: 400 }
      );
    }

    const messages = await chatService.getMessages(targetDocIds);
    return NextResponse.json<ApiResponse<ChatMessage[]>>({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Failed to retrieve chat history." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { documentId, documentIds, message } = body;

    // 1. Validation & Multi-Document ID extraction
    let targetDocIds: string[] = [];
    if (Array.isArray(documentIds) && documentIds.length > 0) {
      targetDocIds = Array.from(new Set(documentIds.map((id) => String(id).trim()))).filter(Boolean);
    } else if (typeof documentId === "string" && documentId.trim()) {
      targetDocIds = [documentId.trim()];
    }

    if (targetDocIds.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "A valid documentId or documentIds array is required." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Question message cannot be empty." },
        { status: 400 }
      );
    }

    const cleanMessage = message.trim();
    const isMultiDoc = targetDocIds.length > 1;

    // 2. Context Retrieval (Single Document vs Isolated Multi-Document)
    let singleContext: DocumentContext | null = null;
    let multiContext: MultiDocumentContext | null = null;
    let systemPrompt = "";

    try {
      if (isMultiDoc) {
        multiContext = await contextService.getMultiDocumentContext(targetDocIds, cleanMessage);
        systemPrompt = aiService.buildMultiDocumentSystemPrompt(
          multiContext.documents,
          multiContext.contextText
        );
      } else {
        singleContext = await contextService.getDocumentContext(targetDocIds[0], cleanMessage);
        systemPrompt = aiService.buildSystemPrompt(
          singleContext.documentName,
          singleContext.contextText,
          {
            isPartialRetrieval: singleContext.isPartialRetrieval,
            totalChunksInDocument: singleContext.totalChunksInDocument,
            retrievedChunksCount: singleContext.retrievedChunksCount,
            retrievalConfidence: singleContext.retrievalConfidence,
          }
        );
      }
    } catch (contextErr: any) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: contextErr.message || "Failed to retrieve contract context.",
        },
        { status: contextErr.message?.includes("could not be found") ? 404 : 400 }
      );
    }

    // 3. Save User Message to MongoDB
    const userMsgId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const assistantMsgId = `asst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const userMessage: ChatMessage = {
      id: userMsgId,
      documentId: targetDocIds[0],
      documentIds: targetDocIds,
      role: "user",
      content: cleanMessage,
      timestamp: new Date().toISOString(),
      status: "complete",
    };
    await chatService.saveMessage(targetDocIds, userMessage);

    // Initial placeholder for Assistant Message
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      documentId: targetDocIds[0],
      documentIds: targetDocIds,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      status: "streaming",
    };
    await chatService.saveMessage(targetDocIds, initialAssistantMsg);

    // 4. Build prompt & conversation history
    const existingHistory = await chatService.getMessages(targetDocIds);
    const historySlice = existingHistory
      .filter((m) => m.id !== userMsgId && m.id !== assistantMsgId && m.status === "complete")
      .slice(-4);

    const aiMessages: AiChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...historySlice.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: cleanMessage },
    ];

    // 5. Setup SSE Stream with Client Disconnect & Stop support
    const abortController = new AbortController();
    request.signal.addEventListener("abort", () => {
      abortController.abort();
    });

    const encoder = new TextEncoder();

    // Prepare retrieval metadata
    const retrievalMetaPayload = isMultiDoc && multiContext
      ? {
          type: "retrieval_meta",
          sectionsRetrieved: multiContext.totalRetrievedChunks,
          totalSections: multiContext.totalChunksAcrossDocs,
          isPartial: multiContext.isPartialRetrieval,
          documents: multiContext.documents.map((d) => ({
            documentId: d.documentId,
            documentName: d.documentName,
            retrievedCount: d.retrievedChunksCount,
            totalCount: d.totalChunksInDocument,
            isPartial: d.isPartialRetrieval,
          })),
          messageId: assistantMsgId,
        }
      : {
          type: "retrieval_meta",
          sectionsRetrieved: singleContext?.retrievedChunksCount ?? 0,
          totalSections: singleContext?.totalChunksInDocument ?? 0,
          isPartial: singleContext?.isPartialRetrieval ?? false,
          messageId: assistantMsgId,
        };

    const stream = new ReadableStream({
      async start(controller) {
        let accumulatedTokens = "";

        try {
          // Emit initial retrieval metadata event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(retrievalMetaPayload)}\n\n`));

          const result = await aiService.streamChat(
            aiMessages,
            (token) => {
              accumulatedTokens += token;
              const tokenPayload = JSON.stringify({
                type: "token",
                content: token,
                messageId: assistantMsgId,
              });
              controller.enqueue(encoder.encode(`data: ${tokenPayload}\n\n`));
            },
            abortController.signal
          );

          // Deterministic Quote Verification Engine (Phase 4 & Phase 7):
          // Independently verify every candidate quote against actual document text
          const verifiedQuotes: VerifiedQuote[] = [];
          if (result.candidateQuotes && result.candidateQuotes.length > 0) {
            for (const candidate of result.candidateQuotes) {
              if (!candidate.text || !candidate.text.trim()) continue;

              // Check if candidate explicitly specified a target document
              let verified = false;
              if (candidate.documentId && targetDocIds.includes(candidate.documentId)) {
                const vRes = await quoteVerificationService.verifyQuote(
                  candidate.documentId,
                  candidate.text
                );
                if (vRes.isVerified) {
                  verifiedQuotes.push(vRes);
                  verified = true;
                }
              }

              // If candidate did not specify document or verification failed,
              // check across each of the selected target documents
              if (!verified) {
                for (const docId of targetDocIds) {
                  if (candidate.documentId && docId === candidate.documentId) continue;
                  const vRes = await quoteVerificationService.verifyQuote(docId, candidate.text);
                  if (vRes.isVerified) {
                    verifiedQuotes.push(vRes);
                    break;
                  }
                }
              }
            }

            // Emit verified quotes to the client (only genuinely verified quotes)
            const verifiedPayload = JSON.stringify({
              type: "verified_quotes",
              verifiedQuotes,
              candidateQuotes: result.candidateQuotes,
              messageId: assistantMsgId,
            });
            controller.enqueue(encoder.encode(`data: ${verifiedPayload}\n\n`));
          }

          // Update completed assistant message in MongoDB with verified citations, candidates, and retrieval metadata
          await chatService.updateMessage(targetDocIds, assistantMsgId, {
            content: result.answerText || accumulatedTokens,
            status: "complete",
            candidateQuotes: result.candidateQuotes,
            citations: verifiedQuotes,
            retrievalMetadata: {
              sectionsRetrieved: isMultiDoc
                ? multiContext?.totalRetrievedChunks
                : singleContext?.retrievedChunksCount,
              totalSections: isMultiDoc
                ? multiContext?.totalChunksAcrossDocs
                : singleContext?.totalChunksInDocument,
              isPartial: isMultiDoc
                ? multiContext?.isPartialRetrieval
                : singleContext?.isPartialRetrieval,
              strategy: "lexical",
              documents: isMultiDoc && multiContext
                ? multiContext.documents.map((d) => ({
                    documentId: d.documentId,
                    documentName: d.documentName,
                    retrievedCount: d.retrievedChunksCount,
                    totalCount: d.totalChunksInDocument,
                    isPartial: d.isPartialRetrieval,
                  }))
                : undefined,
            },
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (streamErr: any) {
          if (streamErr.name === "AbortError" || abortController.signal.aborted) {
            // User requested STOP GENERATING: preserve all tokens received so far!
            await chatService.updateMessage(targetDocIds, assistantMsgId, {
              content: accumulatedTokens,
              status: "stopped",
            });

            const stopPayload = JSON.stringify({
              type: "stopped",
              content: accumulatedTokens,
              messageId: assistantMsgId,
            });
            controller.enqueue(encoder.encode(`data: ${stopPayload}\n\n`));
            controller.close();
          } else {
            // General AI failure: preserve partial tokens and record error
            await chatService.updateMessage(targetDocIds, assistantMsgId, {
              content: accumulatedTokens,
              status: "error",
              error: streamErr.message || "AI generation failed.",
            });

            const errorPayload = JSON.stringify({
              type: "error",
              error: streamErr.message || "An unexpected error occurred during generation.",
              messageId: assistantMsgId,
            });
            controller.enqueue(encoder.encode(`data: ${errorPayload}\n\n`));
            controller.close();
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message || "Internal server error occurred in chat endpoint.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const documentIdsParam = searchParams.get("documentIds");

    let targetDocIds: string[] = [];
    if (documentIdsParam) {
      targetDocIds = documentIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (documentId && documentId.trim()) {
      targetDocIds = [documentId.trim()];
    }

    if (targetDocIds.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "documentId or documentIds query parameter is required." },
        { status: 400 }
      );
    }

    await chatService.clearDocumentChat(targetDocIds);
    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Failed to clear chat." },
      { status: 500 }
    );
  }
}
