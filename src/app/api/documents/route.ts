import { NextRequest, NextResponse } from "next/server";
import { documentService } from "@/services/document-service";
import { ApiResponse, DocumentMetadata } from "@/types";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

export async function GET() {
  try {
    const docs = await documentService.getAllDocuments();
    return NextResponse.json<ApiResponse<DocumentMetadata[]>>({
      success: true,
      data: docs,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<DocumentMetadata[]>>(
      {
        success: false,
        error: error.message || "Failed to fetch documents from database",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "No file uploaded. Please select a PDF or DOCX file." },
        { status: 400 }
      );
    }

    // 1. File size validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `File exceeds maximum allowed size of 50 MB.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "The uploaded file is empty (0 bytes)." },
        { status: 400 }
      );
    }

    // 2. File extension validation
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!hasValidExt) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Unsupported file type. Only PDF (.pdf) and DOCX (.docx) documents are supported.",
        },
        { status: 400 }
      );
    }

    // 3. Process the file through extraction pipeline
    const processedDoc = await documentService.processUploadedFile(file);

    return NextResponse.json<ApiResponse<DocumentMetadata>>(
      {
        success: true,
        data: processedDoc,
        message: "Document uploaded and processed successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    // If document was created in DB but extraction failed (e.g., scanned PDF)
    const status = error.document ? 422 : 500;
    return NextResponse.json<ApiResponse<DocumentMetadata>>(
      {
        success: false,
        error: error.message || "Failed to process document upload",
        data: error.document,
      },
      { status }
    );
  }
}
