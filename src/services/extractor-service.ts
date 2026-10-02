import { getDocumentProxy, extractText } from "unpdf";
import mammoth from "mammoth";
import { DocumentPage } from "@/types";

export interface ExtractionResult {
  fullText: string;
  pageCount: number;
  pages: DocumentPage[];
  paragraphs: string[];
  textLength: number;
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

export const extractorService = {
  /**
   * Extracts text and page/paragraph metadata from a PDF file buffer.
   */
  async extractPdf(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const uint8Array = new Uint8Array(buffer);
      const pdf = await getDocumentProxy(uint8Array);
      const { totalPages, text: pageTexts } = await extractText(pdf, {
        mergePages: false,
      });

      const pages: DocumentPage[] = [];
      let accumulatedText = "";

      for (let i = 0; i < pageTexts.length; i++) {
        const rawPageText = pageTexts[i] || "";
        const pageNumber = i + 1;
        const pageTextTrimmed = rawPageText.trim();

        if (i > 0) {
          accumulatedText += "\n\n";
        }
        const startOffset = accumulatedText.length;
        accumulatedText += rawPageText;
        const endOffset = accumulatedText.length;

        pages.push({
          pageNumber,
          text: rawPageText,
          textLength: pageTextTrimmed.length,
          startOffset,
          endOffset,
        });
      }

      const fullText = accumulatedText.trim();
      const nonWhitespaceCount = fullText.replace(/\s+/g, "").length;

      // Scanned PDF detection:
      // If the document has pages but no readable text or fewer than 20 non-whitespace characters,
      // it is an image-only / scanned document without OCR text layer.
      if (
        totalPages === 0 ||
        fullText.length === 0 ||
        nonWhitespaceCount < 20 ||
        (totalPages > 1 && nonWhitespaceCount / totalPages < 5)
      ) {
        throw new ExtractionError(
          "Unable to extract readable text from this PDF. It may be a scanned/image-only document."
        );
      }

      // Extract paragraphs based on double newlines
      const paragraphs = fullText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      return {
        fullText,
        pageCount: totalPages,
        pages,
        paragraphs,
        textLength: fullText.length,
      };
    } catch (err: any) {
      if (err instanceof ExtractionError) {
        throw err;
      }
      throw new ExtractionError(
        err.message?.includes("password")
          ? "This PDF is password-protected and cannot be extracted."
          : `Failed to extract PDF text: ${err.message || "Unknown error"}`
      );
    }
  },

  /**
   * Extracts text and paragraph structure from a DOCX file buffer.
   */
  async extractDocx(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const rawText = (result.value || "").replace(/\r\n/g, "\n").trim();

      if (rawText.length === 0 || rawText.replace(/\s+/g, "").length < 10) {
        throw new ExtractionError(
          "Unable to extract readable text from this DOCX document. The file appears to be empty."
        );
      }

      // Split into paragraphs preserving paragraph boundaries
      const rawParagraphs = rawText.split(/\n\s*\n/);
      const paragraphs = rawParagraphs
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      // Group paragraphs into logical pages (~2500 characters per page)
      const pages: DocumentPage[] = [];
      let currentPageText = "";
      let currentPageNum = 1;

      for (const para of paragraphs) {
        if (currentPageText.length + para.length > 2500 && currentPageText.length > 0) {
          pages.push({
            pageNumber: currentPageNum,
            text: currentPageText,
            textLength: currentPageText.length,
            startOffset: 0,
            endOffset: 0,
          });
          currentPageNum++;
          currentPageText = para;
        } else {
          currentPageText += (currentPageText ? "\n\n" : "") + para;
        }
      }

      if (currentPageText.length > 0) {
        pages.push({
          pageNumber: currentPageNum,
          text: currentPageText,
          textLength: currentPageText.length,
          startOffset: 0,
          endOffset: 0,
        });
      }

      // Reconstruct fullText from pages with deterministic \n\n separators
      // This ensures 100% exact alignment: fullText.slice(page.startOffset, page.endOffset) === page.text
      let accumulatedDocxText = "";
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) {
          accumulatedDocxText += "\n\n";
        }
        pages[i].startOffset = accumulatedDocxText.length;
        accumulatedDocxText += pages[i].text;
        pages[i].endOffset = accumulatedDocxText.length;
      }
      const fullText = accumulatedDocxText;

      return {
        fullText,
        pageCount: Math.max(1, pages.length),
        pages,
        paragraphs,
        textLength: fullText.length,
      };
    } catch (err: any) {
      if (err instanceof ExtractionError) {
        throw err;
      }
      throw new ExtractionError(
        `Failed to extract DOCX text: ${err.message || "Invalid or corrupted DOCX file"}`
      );
    }
  },
};
