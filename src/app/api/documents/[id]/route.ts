import { NextRequest, NextResponse } from "next/server";
import { documentService } from "@/services/document-service";
import { ApiResponse, ExtractedDocument } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const document = await documentService.getDocumentById(id);

    if (!document) {
      return NextResponse.json<ApiResponse<ExtractedDocument>>(
        { success: false, error: "Contract document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<ExtractedDocument>>({
      success: true,
      data: document,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Failed to retrieve document" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await documentService.deleteDocument(id);

    if (!deleted) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Contract document not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
