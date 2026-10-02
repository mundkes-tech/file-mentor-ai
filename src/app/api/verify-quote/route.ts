import { NextRequest, NextResponse } from "next/server";
import { quoteVerificationService } from "@/services/quote-verification-service";
import { ApiResponse, VerifiedQuote } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { documentId, claimedPage } = body;
    const quote = body.quote || body.candidateQuote;

    // 1. Validation
    if (!documentId || typeof documentId !== "string" || !documentId.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "A valid documentId is required." },
        { status: 400 }
      );
    }

    if (!quote || typeof quote !== "string" || !quote.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Quote string cannot be empty." },
        { status: 400 }
      );
    }

    const cleanDocId = documentId.trim();
    const cleanQuote = quote.trim();
    const parsedClaimedPage =
      typeof claimedPage === "number" && !isNaN(claimedPage) ? claimedPage : undefined;

    const result = await quoteVerificationService.verifyQuote(
      cleanDocId,
      cleanQuote,
      parsedClaimedPage
    );

    // If document is not found, return 404
    if (!result.isVerified && result.reason === "Document not found") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Document not found." },
        { status: 404 }
      );
    }

    // If document is not ready, return 400
    if (!result.isVerified && result.reason?.includes("not ready")) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<VerifiedQuote>>({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Quote verification failed." },
      { status: 500 }
    );
  }
}
