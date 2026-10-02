import { DocumentChunk, DocumentPage } from "@/types";
import { DocumentChunkModel, IDocumentChunk } from "@/models/DocumentChunk";
import { DocumentModel } from "@/models/Document";
import { connectToDatabase } from "@/lib/mongodb";
import { CHUNK_CONFIG } from "@/lib/constants";

export interface ChunkingOptions {
  targetChunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
}

interface RawTextBlock {
  text: string;
  startOffset: number;
  endOffset: number;
  isHeading: boolean;
  headingText?: string;
}

/**
 * Finds the corresponding page number for a given character offset in the document.
 */
export function findPageForOffset(offset: number, pages: DocumentPage[]): number {
  if (!pages || pages.length === 0) {
    return 1;
  }

  for (const page of pages) {
    const start = page.startOffset ?? 0;
    const end = page.endOffset ?? Infinity;
    if (offset >= start && offset <= end) {
      return page.pageNumber;
    }
  }

  // If before first page
  if (offset < (pages[0].startOffset ?? 0)) {
    return pages[0].pageNumber;
  }

  // If past last page
  return pages[pages.length - 1].pageNumber;
}

/**
 * Heuristic to detect whether a text block represents a legal heading or clause title.
 */
function isLegalHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return false;
  }

  // Pattern 1: Explicit Section, Article, Clause, Schedule, Exhibit keywords
  if (
    /^(?:SECTION|ARTICLE|CLAUSE|SCHEDULE|EXHIBIT|APPENDIX|PART)\s+[0-9A-ZIVX]+[\.:\s\-].*$/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Pattern 2: Numbered section (e.g., "1. Definitions", "2.1 Scope of License", "14. Termination")
  if (/^[0-9]+(\.[0-9]+)*[\.\)]\s+[A-Z][A-Za-z0-9\s,\-–—]{2,80}$/.test(trimmed)) {
    return true;
  }

  // Pattern 3: ALL-CAPS short titles (e.g., "CONFIDENTIALITY", "LIMITATION OF LIABILITY", "GOVERNING LAW")
  if (/^[A-Z0-9\s,\-–—\(\)\/]{4,60}$/.test(trimmed) && /[A-Z]{3,}/.test(trimmed)) {
    return true;
  }

  // Pattern 4: Title ending with colon (e.g., "Term and Termination:")
  if (/^[A-Z][A-Za-z0-9\s,\-–—]{2,50}:$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Splits extracted document text into structural blocks (paragraphs, sections, headings)
 * while preserving exact start and end character offsets in the raw document text.
 */
function extractTextBlocks(fullText: string): RawTextBlock[] {
  const blocks: RawTextBlock[] = [];
  if (!fullText || fullText.trim().length === 0) {
    return blocks;
  }

  // Match paragraphs separated by one or more blank lines
  const paragraphRegex = /[^\r\n]+(?:\r?\n(?![ \t]*\r?\n)[^\r\n]+)*/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphRegex.exec(fullText)) !== null) {
    const rawBlock = match[0];
    const startOffset = match.index;
    const endOffset = startOffset + rawBlock.length;
    const trimmed = rawBlock.trim();

    if (trimmed.length > 0) {
      const heading = isLegalHeading(trimmed);
      blocks.push({
        text: rawBlock,
        startOffset,
        endOffset,
        isHeading: heading,
        headingText: heading ? trimmed : undefined,
      });
    }
  }

  // Fallback: If no distinct paragraphs were matched, treat the whole text as one block
  if (blocks.length === 0 && fullText.trim().length > 0) {
    blocks.push({
      text: fullText,
      startOffset: 0,
      endOffset: fullText.length,
      isHeading: false,
    });
  }

  return blocks;
}

/**
 * Splits an excessively large text block into smaller sentences preserving offsets.
 */
function splitLargeBlock(
  block: RawTextBlock,
  maxSize: number,
  fullText: string
): RawTextBlock[] {
  if (block.text.length <= maxSize) {
    return [block];
  }

  const subBlocks: RawTextBlock[] = [];
  // Split on sentence boundaries: period, question mark, or newline followed by space or capital
  const sentenceRegex = /[^.!?\r\n]+(?:[.!?]+|\r?\n|$)/g;
  let match: RegExpExecArray | null;
  let currentSub = "";
  let subStart = block.startOffset;

  while ((match = sentenceRegex.exec(block.text)) !== null) {
    const sentence = match[0];
    if (currentSub.length + sentence.length > maxSize && currentSub.length > 0) {
      const subEnd = subStart + currentSub.length;
      subBlocks.push({
        text: currentSub,
        startOffset: subStart,
        endOffset: subEnd,
        isHeading: false,
      });
      subStart = subEnd;
      currentSub = sentence;
    } else {
      currentSub += sentence;
    }
  }

  if (currentSub.length > 0) {
    const subEnd = subStart + currentSub.length;
    subBlocks.push({
      text: currentSub,
      startOffset: subStart,
      endOffset: subEnd,
      isHeading: false,
    });
  }

  return subBlocks.length > 0 ? subBlocks : [block];
}

export const chunkingService = {
  /**
   * Splits extracted document text into semantically cohesive, structure-preserving chunks.
   * Preserves paragraphs, legal headings, sections, clauses, and maps exact character offsets
   * and page boundaries.
   */
  generateChunks(
    documentId: string,
    fullText: string,
    pages: DocumentPage[] = [],
    options: ChunkingOptions = {}
  ): DocumentChunk[] {
    if (!fullText || fullText.trim().length === 0) {
      return [];
    }

    const targetSize = options.targetChunkSize ?? CHUNK_CONFIG.targetChunkSize;
    const minSize = options.minChunkSize ?? CHUNK_CONFIG.minChunkSize;
    const maxSize = options.maxChunkSize ?? CHUNK_CONFIG.maxChunkSize;

    // 1. Parse full text into structural blocks
    const rawBlocks = extractTextBlocks(fullText);

    // 2. Normalize oversized blocks
    const normalizedBlocks: RawTextBlock[] = [];
    for (const b of rawBlocks) {
      if (b.text.length > maxSize) {
        normalizedBlocks.push(...splitLargeBlock(b, targetSize, fullText));
      } else {
        normalizedBlocks.push(b);
      }
    }

    const chunks: DocumentChunk[] = [];
    let currentBlocks: RawTextBlock[] = [];
    let currentLength = 0;
    let currentHeading: string | undefined = undefined;

    const flushChunk = () => {
      if (currentBlocks.length === 0) return;

      const firstBlock = currentBlocks[0];
      const lastBlock = currentBlocks[currentBlocks.length - 1];

      const rawStart = firstBlock.startOffset;
      const rawEnd = lastBlock.endOffset;
      const rawSlice = fullText.slice(rawStart, rawEnd);

      // Compute precise trimmed offsets so chunk.text === fullText.slice(startOffset, endOffset)
      const leadingWhitespace = rawSlice.length - rawSlice.trimStart().length;
      const trailingWhitespace = rawSlice.length - rawSlice.trimEnd().length;

      const startOffset = rawStart + leadingWhitespace;
      const endOffset = rawEnd - trailingWhitespace;
      const text = fullText.slice(startOffset, endOffset);

      if (text.length > 0) {
        const pageStart = findPageForOffset(startOffset, pages);
        const pageEnd = findPageForOffset(Math.max(startOffset, endOffset - 1), pages);
        const chunkIndex = chunks.length;
        const chunkId = `${documentId}_chunk_${chunkIndex}`;

        // Approximate token count (1 token ≈ 4 characters)
        const tokenCount = Math.round(text.length / 4);

        chunks.push({
          id: chunkId,
          chunkId,
          documentId,
          chunkIndex,
          text,
          pageNumber: pageStart,
          pageStart,
          pageEnd,
          startOffset,
          endOffset,
          sectionHeading: currentHeading,
          tokenCount,
        });
      }

      currentBlocks = [];
      currentLength = 0;
      currentHeading = undefined;
    };

    for (let i = 0; i < normalizedBlocks.length; i++) {
      const block = normalizedBlocks[i];

      // If this block is a legal heading and we already have sufficient content,
      // start a new chunk boundary to keep the legal clause intact
      if (block.isHeading && currentLength >= minSize) {
        flushChunk();
      }

      if (block.isHeading && !currentHeading) {
        currentHeading = block.headingText || block.text.trim();
      }

      // Check if adding this block would exceed the target chunk size
      if (currentLength + block.text.length > targetSize && currentLength >= minSize) {
        flushChunk();

        // If the block is a heading, assign it as the new chunk's heading
        if (block.isHeading) {
          currentHeading = block.headingText || block.text.trim();
        }
      }

      currentBlocks.push(block);
      currentLength += block.text.length;
    }

    // Flush any remaining accumulated blocks
    flushChunk();

    return chunks;
  },

  /**
   * Stores chunks into MongoDB for a document, cleanly replacing any prior chunks.
   */
  async storeChunks(documentId: string, chunks: DocumentChunk[]): Promise<void> {
    await connectToDatabase();

    // 1. Cleanly purge any existing chunks for this document (ensures no duplicates on regeneration)
    await DocumentChunkModel.deleteMany({ documentId });

    if (chunks.length === 0) {
      return;
    }

    // 2. Bulk insert all chunks with ordered: false for high performance
    const records = chunks.map((chunk) => ({
      _id: chunk.chunkId || `${documentId}_chunk_${chunk.chunkIndex}`,
      documentId,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      sectionHeading: chunk.sectionHeading,
      tokenCount: chunk.tokenCount || Math.round(chunk.text.length / 4),
    }));

    await DocumentChunkModel.insertMany(records, { ordered: false });
  },

  /**
   * Complete pipeline helper: generates chunks and stores them into MongoDB.
   */
  async createAndStoreChunks(
    documentId: string,
    fullText: string,
    pages: DocumentPage[] = [],
    paragraphs: string[] = [],
    options: ChunkingOptions = {}
  ): Promise<DocumentChunk[]> {
    const chunks = this.generateChunks(documentId, fullText, pages, options);
    await this.storeChunks(documentId, chunks);
    return chunks;
  },

  /**
   * Lazy chunk generation utility:
   * Ensures that chunks exist in MongoDB for a ready document. If none exist (e.g. uploaded in
   * earlier phases), generates and persists them seamlessly without requiring re-upload.
   */
  async ensureChunksForDocument(documentId: string): Promise<number> {
    await connectToDatabase();

    const existingCount = await DocumentChunkModel.countDocuments({ documentId });
    if (existingCount > 0) {
      return existingCount;
    }

    // Fetch document from MongoDB to generate chunks lazily
    if (!documentId || typeof documentId !== "string" || !documentId.trim() || documentId.length > 100) {
      return 0;
    }
    const doc = await DocumentModel.findById(documentId.trim()).lean();
    if (!doc || doc.processingStatus !== "ready" || !doc.extractedText) {
      return 0;
    }

    const chunks = await this.createAndStoreChunks(
      documentId,
      doc.extractedText,
      doc.pages || [],
      doc.paragraphs || []
    );

    return chunks.length;
  },

  /**
   * Retrieves all persisted chunks for a specific document.
   */
  async getChunksForDocument(documentId: string): Promise<DocumentChunk[]> {
    await connectToDatabase();
    const records = await DocumentChunkModel.find({ documentId })
      .sort({ chunkIndex: 1 })
      .lean();

    return records.map((r) => ({
      id: r._id,
      chunkId: r._id,
      documentId: r.documentId,
      chunkIndex: r.chunkIndex,
      text: r.text,
      pageNumber: r.pageStart,
      pageStart: r.pageStart,
      pageEnd: r.pageEnd,
      startOffset: r.startOffset,
      endOffset: r.endOffset,
      sectionHeading: r.sectionHeading,
      tokenCount: r.tokenCount,
      createdAt: r.createdAt,
    }));
  },

  /**
   * Deletes all chunks associated with a document (used on document deletion).
   */
  async deleteChunksForDocument(documentId: string): Promise<number> {
    await connectToDatabase();
    const result = await DocumentChunkModel.deleteMany({ documentId });
    return result.deletedCount || 0;
  },
};
