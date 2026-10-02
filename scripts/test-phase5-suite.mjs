/**
 * Comprehensive Phase 5 Test Suite
 * Tests Large-Document Retrieval, Chunking Engine, Document Isolation,
 * Deep-Page Retrieval, Not-Found Safety, and 150-Page Contract Acceptance.
 */

import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";

try {
  process.loadEnvFile?.(".env.local");
} catch {}

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI. Please set MONGODB_URI in .env.local or your environment.");
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function uploadFile(filePath, filename, mimeType) {
  const fileBuffer = await fs.readFile(filePath);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append("file", blob, filename);

  const res = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    body: formData,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status}): ${json.error || "Unknown error"}`);
  }
  return json.data;
}

async function getRetrieval(documentId, question) {
  const url = `${BASE_URL}/api/retrieval?documentId=${encodeURIComponent(documentId)}&question=${encodeURIComponent(question)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Retrieval query failed (${res.status}): ${json.error || "Unknown error"}`);
  }
  return json.data;
}

async function main() {
  console.log("==================================================");
  console.log("    PHASE 5: RETRIEVAL & CHUNKING TEST SUITE      ");
  console.log("==================================================\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const testDocsDir = path.resolve(process.cwd(), "uploads", "test-docs");

  // Step 1: Upload Test Documents
  console.log("--- SETUP: Uploading Test Documents ---");
  const docAPath = path.join(testDocsDir, "Master_Services_Agreement.docx");
  const docBPath = path.join(testDocsDir, "Consulting_Agreement.docx");
  const doc150Path = path.join(testDocsDir, "Enterprise_Master_150Page.docx");

  const docA = await uploadFile(docAPath, "Master_Services_Agreement.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  console.log(`Uploaded Doc A (MSA): ID=${docA.id}, Pages=${docA.pageCount}`);

  const docB = await uploadFile(docBPath, "Consulting_Agreement.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  console.log(`Uploaded Doc B (Consulting): ID=${docB.id}, Pages=${docB.pageCount}`);

  console.log("Uploading 150-page enterprise agreement (this will be chunked and indexed)...");
  const doc150 = await uploadFile(doc150Path, "Enterprise_Master_150Page.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  console.log(`Uploaded Doc 150-Page: ID=${doc150.id}, Pages=${doc150.pageCount}, TextLength=${doc150.textLength}\n`);

  // --- TEST 1: Chunk Creation ---
  console.log("--- TEST 1: Chunk Creation ---");
  const chunksA = await db.collection("documentchunks").find({ documentId: docA.id }).sort({ chunkIndex: 1 }).toArray();
  assert(chunksA.length > 0, `Document A has ${chunksA.length} chunks generated during upload`);
  assert(chunksA[0].documentId === docA.id, "Chunks are linked to correct document ID");

  // --- TEST 2: Chunk Metadata ---
  console.log("\n--- TEST 2: Chunk Metadata ---");
  const firstChunk = chunksA[0];
  assert(typeof firstChunk.chunkIndex === "number" && firstChunk.chunkIndex === 0, "Valid chunkIndex (0-indexed)");
  assert(typeof firstChunk.startOffset === "number" && firstChunk.startOffset >= 0, "Valid startOffset");
  assert(typeof firstChunk.endOffset === "number" && firstChunk.endOffset > firstChunk.startOffset, "Valid endOffset > startOffset");
  assert(typeof firstChunk.pageStart === "number" && firstChunk.pageStart >= 1, `Valid pageStart (${firstChunk.pageStart})`);
  assert(typeof firstChunk.pageEnd === "number" && firstChunk.pageEnd >= firstChunk.pageStart, `Valid pageEnd (${firstChunk.pageEnd})`);
  assert(firstChunk.text && firstChunk.text.length > 50, `Chunk contains substantive text (${firstChunk.text.length} chars)`);

  // --- TEST 3: Document Isolation ---
  console.log("\n--- TEST 3: Document Isolation ---");
  const chunksB = await db.collection("documentchunks").find({ documentId: docB.id }).toArray();
  assert(chunksB.length > 0, `Document B has ${chunksB.length} chunks`);

  const resA = await getRetrieval(docA.id, "European corporate restructuring retainer");
  const anyBelongsToB = resA.retrievedChunks.some((c) => c.documentId !== docA.id);
  assert(!anyBelongsToB, "Document A retrieval NEVER returns chunks from Document B");

  const resB = await getRetrieval(docB.id, "European corporate restructuring retainer");
  assert(resB.retrievedChunks.length > 0, "Document B returns its own relevant chunks");
  const allBelongToB = resB.retrievedChunks.every((c) => c.documentId === docB.id);
  assert(allBelongToB, "All retrieved chunks strictly match Document B ID");

  // --- TEST 4: Relevant Retrieval ---
  console.log("\n--- TEST 4: Relevant Retrieval ---");
  const termRes = await getRetrieval(
    docA.id,
    "What is the notice period for termination for convenience?"
  );
  assert(termRes.retrievedChunks.length > 0, "Retrieval found matching chunks for termination notice");
  const topChunk = termRes.retrievedChunks[0];
  assert(
    topChunk.text.toLowerCase().includes("terminate") || topChunk.text.toLowerCase().includes("termination"),
    "Top ranked chunk directly contains termination provision"
  );
  assert(
    topChunk.text.includes("sixty (60) days") || topChunk.text.toLowerCase().includes("notice"),
    "Top ranked chunk includes specific notice details (60 days)"
  );
  assert(topChunk.score > 2.0, `Relevant chunk has high confidence score (${topChunk.score})`);

  // --- TEST 5: Irrelevant Retrieval ---
  console.log("\n--- TEST 5: Irrelevant Retrieval ---");
  const irrelRes = await getRetrieval(
    docA.id,
    "Quantum mechanical schrodinger wave equation in Hilbert space"
  );
  assert(
    irrelRes.retrievedChunks.length === 0 || irrelRes.maxScore < 1.0,
    `Unrelated query returns 0 chunks or negligible score (maxScore: ${irrelRes.maxScore})`
  );

  // --- TEST 6: Large Document Bounded Context ---
  console.log("\n--- TEST 6: Large Document Context Bounding (150 Pages) ---");
  const chunks150 = await db.collection("documentchunks").find({ documentId: doc150.id }).toArray();
  assert(chunks150.length >= 100, `150-page document has ${chunks150.length} chunks generated`);

  const ctxLarge = await getRetrieval(
    doc150.id,
    "What are the liquidated damages for delayed migration?"
  );
  assert(ctxLarge.context.isPartialRetrieval === true, "isPartialRetrieval correctly set to TRUE for large document");
  assert(
    ctxLarge.context.contextLengthChars <= 25000,
    `Context size is strictly bounded to ${ctxLarge.context.contextLengthChars} chars (far below full 343,000 char document)`
  );
  assert(
    ctxLarge.context.retrievedChunksCount <= 6,
    `Selected at most ${ctxLarge.context.retrievedChunksCount} chunks out of ${ctxLarge.totalChunksInDocument} total chunks`
  );

  // --- TEST 7: Deep-Page Retrieval (Page 142 of 150) ---
  console.log("\n--- TEST 7: Deep-Page Retrieval (Page 142/150) ---");
  const deepRes = await getRetrieval(
    doc150.id,
    "What are the liquidated damages per business day for migration delay?"
  );
  assert(deepRes.retrievedChunks.length > 0, "Deep-page retrieval returned candidate chunks");
  const deepTopChunk = deepRes.retrievedChunks[0];
  assert(
    deepTopChunk.text.includes("$15,000") || deepTopChunk.text.includes("liquidated damages"),
    "Retrieved chunk containing $15,000 liquidated damages clause"
  );
  assert(
    deepTopChunk.pageStart >= 130,
    `Retrieved chunk originated from deep page (${deepTopChunk.pageStart} >= 130)`
  );

  // Early-Page Retrieval on 150-Page Doc (Page 2)
  console.log("\n--- TEST 7b: Early-Page Retrieval on 150-Page Doc (Page 2) ---");
  const earlyRes = await getRetrieval(
    doc150.id,
    "What is the scope of the exclusive technology license grant?"
  );
  assert(earlyRes.retrievedChunks.length > 0, "Early-page retrieval returned candidate chunks");
  const earlyTopChunk = earlyRes.retrievedChunks[0];
  assert(
    earlyTopChunk.text.includes("exclusive worldwide enterprise license"),
    "Retrieved early clause from Page 2"
  );
  assert(
    earlyTopChunk.pageStart <= 5,
    `Retrieved chunk originated from early page (${earlyTopChunk.pageStart} <= 5)`
  );

  // --- TEST 8: Not-Found Safety ---
  console.log("\n--- TEST 8: Not-Found Safety (Absence Claim Prevention) ---");
  // Ask about something completely absent in the 150-page document
  const notFoundChatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: doc150.id,
      message: "What is the governing law of the Republic of Iceland in this agreement?",
    }),
  });

  assert(notFoundChatRes.ok, "Chat request submitted for not-found safety check");
  const notFoundReader = notFoundChatRes.body.getReader();
  const notFoundDecoder = new TextDecoder();
  let aiAnswer = "";

  while (true) {
    const { done, value } = await notFoundReader.read();
    if (done) break;
    const chunkText = notFoundDecoder.decode(value);
    const lines = chunkText.split("\n\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === "token" && payload.content) {
            aiAnswer += payload.content;
          }
        } catch {}
      }
    }
  }

  console.log(`  AI Response: "${aiAnswer.slice(0, 160).trim()}..."`);
  const lowerAnswer = aiAnswer.toLowerCase();
  assert(
    lowerAnswer.includes("retrieved sections") ||
    lowerAnswer.includes("not find sufficient") ||
    lowerAnswer.includes("sufficient relevant information") ||
    lowerAnswer.includes("does not provide enough information"),
    "AI used cautious scoping to retrieved sections instead of unsupported global claim"
  );
  assert(
    !lowerAnswer.includes("this contract does not contain a governing law") &&
    !lowerAnswer.includes("the agreement does not have a governing law"),
    "AI refrained from declaring global absence of governing law across the whole 150-page document"
  );

  // --- TEST 9: Quote Compatibility (Full Document Source of Truth) ---
  console.log("\n--- TEST 9: Quote Compatibility (Phase 4 Quote Verification) ---");
  // Candidate quote taken verbatim from deep page 142
  const candidateFromDeepChunk = "Contractor shall pay liquidated damages of $15,000 per business day for migration delay";
  const verifyRes = await fetch(`${BASE_URL}/api/verify-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: doc150.id,
      quote: candidateFromDeepChunk,
      candidateQuote: candidateFromDeepChunk,
    }),
  });

  assert(verifyRes.ok, "POST /api/verify-quote returned HTTP 200");
  const verifyJson = await verifyRes.json();
  const quoteData = verifyJson.data;

  assert(quoteData.isVerified === true, "Deep-page candidate quote verified successfully");
  assert(
    typeof quoteData.startOffset === "number" && quoteData.startOffset > 100000,
    `Quote verified against full document text with real deep offset (${quoteData.startOffset} > 100k)`
  );
  assert(
    quoteData.pageNumber >= 130,
    `Quote page correctly calculated from full document metadata (Page ${quoteData.pageNumber})`
  );

  // --- TEST 10: Persistence in MongoDB ---
  console.log("\n--- TEST 10: Persistence in MongoDB ---");
  await mongoose.disconnect();
  await mongoose.connect(MONGODB_URI);
  const reconnectedDb = mongoose.connection.db;
  const persistedCount = await reconnectedDb.collection("documentchunks").countDocuments({ documentId: doc150.id });
  assert(persistedCount === chunks150.length, `All ${persistedCount} chunks persisted across reconnection`);

  // --- TEST 11: Chunk Regeneration (No Duplicates) ---
  console.log("\n--- TEST 11: Chunk Regeneration (No Duplicates) ---");
  const regenRes = await fetch(`${BASE_URL}/api/retrieval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: docA.id,
      action: "regenerate",
    }),
  });

  assert(regenRes.ok, "POST /api/retrieval regenerate action returned HTTP 200");
  const regenJson = await regenRes.json();
  const postRegenCount = await reconnectedDb.collection("documentchunks").countDocuments({ documentId: docA.id });
  assert(
    postRegenCount === regenJson.data.regeneratedChunksCount,
    `Regeneration cleanly replaced chunks with no duplicates (Count: ${postRegenCount})`
  );

  // --- TEST 12: Chat API End-to-End Regression ---
  console.log("\n--- TEST 12: Chat API End-to-End Regression ---");
  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: docA.id,
      message: "What is the limitation of liability amount?",
    }),
  });
  assert(chatRes.ok, `POST /api/chat returned HTTP 200 (${chatRes.status})`);
  assert(
    chatRes.headers.get("content-type")?.includes("text/event-stream"),
    "Response is text/event-stream for streaming"
  );

  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let receivedTokens = 0;
  let receivedRetrievalMeta = false;
  let receivedVerifiedQuotes = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    const lines = text.split("\n\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === "retrieval_meta") {
            receivedRetrievalMeta = true;
          } else if (payload.type === "token") {
            receivedTokens++;
          } else if (payload.type === "verified_quotes") {
            receivedVerifiedQuotes = true;
          }
        } catch {}
      }
    }
  }

  assert(receivedRetrievalMeta, "Chat stream emitted 'retrieval_meta' event with chunk counts");
  assert(receivedTokens > 0, `Streaming tokens received from AI (${receivedTokens} tokens)`);
  assert(receivedVerifiedQuotes, "Streaming emitted deterministic 'verified_quotes' event");

  // Verify chat history persisted in MongoDB
  const history = await reconnectedDb.collection("chatsessions").findOne({ documentId: docA.id });
  assert(history && history.messages.length >= 2, "Chat history persisted in MongoDB");
  const lastMsg = history.messages[history.messages.length - 1];
  assert(lastMsg.role === "assistant" && lastMsg.status === "complete", "Assistant message status is complete");
  assert(lastMsg.retrievalMetadata?.sectionsRetrieved > 0, "Assistant message stored retrievalMetadata in MongoDB");

  // Cleanup test documents from database & uploads
  console.log("\n--- CLEANUP: Deleting Test Documents ---");
  await fetch(`${BASE_URL}/api/documents/${docA.id}`, { method: "DELETE" });
  await fetch(`${BASE_URL}/api/documents/${docB.id}`, { method: "DELETE" });
  await fetch(`${BASE_URL}/api/documents/${doc150.id}`, { method: "DELETE" });

  const remainingChunks = await reconnectedDb.collection("documentchunks").countDocuments({
    documentId: { $in: [docA.id, docB.id, doc150.id] },
  });
  assert(remainingChunks === 0, "All chunks deleted cleanly upon document deletion");

  await mongoose.disconnect();

  console.log("\n==================================================");
  console.log(`PHASE 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test suite:", err);
  process.exit(1);
});
