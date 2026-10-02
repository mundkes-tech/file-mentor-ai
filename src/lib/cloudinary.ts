import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import path from "path";

/**
 * Checks whether Cloudinary environment variables are configured.
 */
export function isCloudinaryConfigured(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Configures and returns the Cloudinary server-side SDK instance.
 * Throws a sanitized error if credentials are missing.
 */
export function getCloudinaryClient() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary storage is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    api_key: process.env.CLOUDINARY_API_KEY!.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
    secure: true,
  });

  return cloudinary;
}

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  bytes: number;
  format: string;
  resourceType: "raw";
}

export interface CloudinaryUploadOptions {
  filename: string;
  documentId: string;
  mimeType: string;
}

/**
 * Sanitizes a filename to safe alphanumeric, underscore, hyphen characters,
 * retaining its lowercase extension.
 */
function sanitizeRawFilename(filename: string): { base: string; ext: string } {
  const ext = path.extname(filename).toLowerCase();
  const base = path
    .basename(filename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);
  return { base: base || "document", ext };
}

/**
 * Uploads a document (PDF / DOCX) binary buffer to Cloudinary as a raw asset.
 * Uses a structured folder: file-mentor-ai/documents/<documentId>/
 */
export async function uploadDocumentToCloudinary(
  buffer: Buffer,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  const client = getCloudinaryClient();
  const { base, ext } = sanitizeRawFilename(options.filename);
  const safePublicId = `${base}${ext}`;
  const folder = `file-mentor-ai/documents/${options.documentId}`;

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        resource_type: "raw",
        folder,
        public_id: safePublicId,
        overwrite: true,
        use_filename: false,
        unique_filename: false,
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          // Never leak internal credentials in error messages
          const cleanMessage =
            error?.message?.replace(/api_key|api_secret/gi, "credential") ||
            "Cloudinary upload failed";
          reject(new Error(`Document upload to Cloudinary failed: ${cleanMessage}`));
          return;
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          bytes: result.bytes || buffer.length,
          format: ext.replace(".", "") || "raw",
          resourceType: "raw",
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Downloads a raw document from Cloudinary into a Node.js Buffer.
 * Supports download via secureUrl or direct publicId signed retrieval.
 */
export async function downloadDocumentFromCloudinary(
  publicId: string,
  secureUrl?: string
): Promise<Buffer> {
  let downloadUrl = secureUrl;

  if (!downloadUrl) {
    const client = getCloudinaryClient();
    downloadUrl = client.utils.url(publicId, {
      resource_type: "raw",
      secure: true,
      sign_url: true,
    });
  }

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download document from Cloudinary (HTTP ${res.status}): ${res.statusText}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Deletes a document from Cloudinary by its publicId.
 * Fails safely and returns false on error rather than crashing the request.
 */
export async function deleteDocumentFromCloudinary(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured() || !publicId) {
    return false;
  }

  try {
    const client = getCloudinaryClient();
    const result = await client.uploader.destroy(publicId, {
      resource_type: "raw",
      invalidate: true,
    });
    return result.result === "ok";
  } catch (error: any) {
    // Sanitized log - never leak secrets
    console.error("Cloudinary deletion failed safely:", error?.message || "Unknown error");
    return false;
  }
}
