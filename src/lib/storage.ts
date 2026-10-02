import path from "path";
import fs from "fs/promises";
import { UPLOAD_DIR_NAME } from "./constants";

/**
 * Returns the absolute path to the local uploads directory.
 */
export function getUploadsDirectory(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), UPLOAD_DIR_NAME);
}

/**
 * Ensures the uploads directory exists on disk.
 */
export async function ensureUploadsDirectory(): Promise<string> {
  const dir = getUploadsDirectory();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error("Failed to ensure uploads directory:", error);
  }
  return dir;
}

/**
 * Generates a collision-resistant filename preserving extension.
 */
export function generateStoredFileName(originalFilename: string, id: string): string {
  const extension = path.extname(originalFilename).toLowerCase();
  const baseName = path
    .basename(originalFilename, extension)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);
  return `${id}_${baseName}${extension}`;
}

/**
 * Resolves the full path for a stored document file.
 */
export function getStoredFilePath(storedFileName: string): string {
  return path.join(/*turbopackIgnore: true*/ getUploadsDirectory(), storedFileName);
}
