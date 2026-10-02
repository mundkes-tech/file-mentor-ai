import { NextRequest, NextResponse } from "next/server";
import { comparisonService } from "@/services/comparison-service";
import { ApiResponse, DocumentComparisonResult } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const baseId = body.baseId || body.documentAId || body.documentIdA;
    const targetId = body.targetId || body.documentBId || body.documentIdB;

    if (!baseId || !targetId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Both baseId (documentA) and targetId (documentB) are required." },
        { status: 400 }
      );
    }

    if (baseId.trim() === targetId.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Cannot compare a contract with itself. Please select two distinct contracts." },
        { status: 400 }
      );
    }

    const result = await comparisonService.compareContracts(baseId.trim(), targetId.trim());

    return NextResponse.json<ApiResponse<DocumentComparisonResult>>({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes("could not be found");
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Contract comparison failed." },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
