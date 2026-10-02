import { NextRequest, NextResponse } from "next/server";
import { redlineService, sanitizeFilename } from "@/services/redline-service";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let originalBuffer: Buffer | null = null;
    let updatedBuffer: Buffer | null = null;
    let originalFilename = "Original_Contract.docx";
    let updatedFilename = "Updated_Contract.docx";

    // Handle Multipart FormData (file uploads or doc IDs)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const origFile = formData.get("originalFile") as File | null;
      const updFile = formData.get("updatedFile") as File | null;
      const origDocId = formData.get("originalDocId") as string | null;
      const updDocId = formData.get("updatedDocId") as string | null;

      // Extract original file buffer
      if (origFile && typeof origFile.arrayBuffer === "function") {
        if (!origFile.name.toLowerCase().endsWith(".docx")) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "Original file must be a valid .docx document. PDF or other formats are not supported for redlining." },
            { status: 400 }
          );
        }
        originalBuffer = Buffer.from(await origFile.arrayBuffer());
        originalFilename = origFile.name;
      } else if (origDocId) {
        const loaded = await redlineService.getDocumentBuffer(origDocId.trim());
        originalBuffer = loaded.buffer;
        originalFilename = loaded.filename;
      }

      // Extract updated file buffer
      if (updFile && typeof updFile.arrayBuffer === "function") {
        if (!updFile.name.toLowerCase().endsWith(".docx")) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "Updated file must be a valid .docx document. PDF or other formats are not supported for redlining." },
            { status: 400 }
          );
        }
        updatedBuffer = Buffer.from(await updFile.arrayBuffer());
        updatedFilename = updFile.name;
      } else if (updDocId) {
        const loaded = await redlineService.getDocumentBuffer(updDocId.trim());
        updatedBuffer = loaded.buffer;
        updatedFilename = loaded.filename;
      }
    } else {
      // Handle JSON body with document IDs
      const body = await request.json().catch(() => ({}));
      const { originalDocId, updatedDocId } = body;

      if (!originalDocId || !updatedDocId) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Both originalDocId and updatedDocId are required in JSON request." },
          { status: 400 }
        );
      }

      const origLoaded = await redlineService.getDocumentBuffer(originalDocId.trim());
      originalBuffer = origLoaded.buffer;
      originalFilename = origLoaded.filename;

      const updLoaded = await redlineService.getDocumentBuffer(updatedDocId.trim());
      updatedBuffer = updLoaded.buffer;
      updatedFilename = updLoaded.filename;
    }

    // 1. Validation
    if (!originalBuffer || originalBuffer.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Original DOCX document could not be read or is empty." },
        { status: 400 }
      );
    }

    if (!updatedBuffer || updatedBuffer.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Updated DOCX document could not be read or is empty." },
        { status: 400 }
      );
    }

    // 2. Generate Redline
    const result = await redlineService.generateRedline(
      originalBuffer,
      updatedBuffer,
      originalFilename,
      updatedFilename
    );

    // 3. Return response (binary file download or JSON payload)
    const { searchParams } = new URL(request.url);
    const isDirectDownload = searchParams.get("download") === "true";

    if (isDirectDownload) {
      return new Response(new Uint8Array(result.docxBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(result.filename)}"`,
          "Content-Length": result.docxBuffer.length.toString(),
        },
      });
    }

    // Default JSON response containing metadata and base64 encoded DOCX file
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        filename: result.filename,
        summary: result.summary,
        base64: result.docxBuffer.toString("base64"),
        sizeBytes: result.docxBuffer.length,
      },
    });
  } catch (error: any) {
    const isClientError =
      error.message?.includes("not a DOCX") ||
      error.message?.includes("empty") ||
      error.message?.includes("not found") ||
      error.message?.includes("Invalid document ID");

    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Failed to generate contract redline." },
      { status: isClientError ? 400 : 500 }
    );
  }
}
