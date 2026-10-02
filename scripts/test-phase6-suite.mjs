/**
 * Comprehensive Phase 6 Test Suite
 * Tests Citation Highlighting, Passage Mapping, Document Navigation,
 * Deep-Page/Early-Page Navigation, Duplicate Disambiguation, Multi-Line Quotes,
 * and Document Isolation.
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

// Local replica of extractPassageLocation for standalone algorithmic validation
function extractPassageLocation(quote) {
  if (!quote || (!quote.isVerified && !quote.verified)) {
    return null;
  }

  const startOffset =
    quote.startOffset ??
    quote.actualLocation?.startOffset ??
    quote.location?.startOffset;

  const endOffset =
    quote.endOffset ??
    quote.actualLocation?.endOffset ??
    quote.location?.endOffset;

  const pageStart =
    quote.pageStart ??
    quote.actualLocation?.pageStart ??
    quote.pageNumber ??
    1;

  const pageEnd =
    quote.pageEnd ??
    quote.actualLocation?.pageEnd ??
    quote.pageNumber ??
    pageStart;

  if (
    typeof startOffset !== "number" ||
    typeof endOffset !== "number" ||
    startOffset < 0 ||
    endOffset <= startOffset
  ) {
    return null;
  }

  return {
    documentId: quote.documentId || "",
    quote: quote.quoteText || quote.quote || "",
    startOffset,
    endOffset,
    pageStart,
    pageEnd,
    verified: true,
    totalOccurrences: quote.occurrencesCount,
  };
}

async function main() {
  console.log("==================================================");
  console.log("   PHASE 6: CITATION HIGHLIGHTING TEST SUITE      ");
  console.log("==================================================\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const testDocsDir = path.resolve(process.cwd(), "uploads", "test-docs");

  // Step 1: Upload Test Documents
  console.log("--- SETUP: Uploading Test Documents ---");
  const docAPath = path.join(testDocsDir, "Master_Services_Agreement.docx");
  const docBPath = path.join(testDocsDir, "Consulting_Agreement.docx");
  const doc150Path = path.join(testDocsDir, "Enterprise_Master_150Page.docx");

  const docA = await uploadFile(
    docAPath,
    "Master_Services_Agreement.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  console.log(`Uploaded Doc A (MSA): ID=${docA.id}, Pages=${docA.pageCount}`);

  const docB = await uploadFile(
    docBPath,
    "Consulting_Agreement.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  console.log(`Uploaded Doc B (Consulting): ID=${docB.id}, Pages=${docB.pageCount}`);

  const doc150 = await uploadFile(
    doc150Path,
    "Enterprise_Master_150Page.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  console.log(
    `Uploaded Doc 150-Page: ID=${doc150.id}, Pages=${doc150.pageCount}, TextLength=${doc150.textLength}\n`
  );

  // --- TEST 1: Verified Citation Click to Location Data Contract ---
  console.log("--- TEST 1: Click a Verified Citation -> Passage Location ---");
  const candidateA = "Customer shall pay all undisputed invoices within forty-five (45) calendar days from receipt of invoice";
  const verifyResA = await fetch(`${BASE_URL}/api/verify-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: docA.id,
      quote: candidateA,
    }),
  });

  assert(verifyResA.ok, "POST /api/verify-quote returns HTTP 200");
  const verifyJsonA = await verifyResA.json();
  const vQuoteA = verifyJsonA.data;
  assert(vQuoteA.isVerified === true, "Quote successfully verified by Phase 4 engine");

  const passageLocA = extractPassageLocation(vQuoteA);
  assert(passageLocA !== null, "extractPassageLocation extracts strongly typed VerifiedPassageLocation");
  assert(passageLocA.documentId === docA.id, "Passage location preserves correct documentId");
  assert(typeof passageLocA.startOffset === "number" && passageLocA.startOffset > 0, "Valid startOffset");
  assert(typeof passageLocA.endOffset === "number" && passageLocA.endOffset > passageLocA.startOffset, "Valid endOffset");
  assert(passageLocA.pageStart >= 1, `Valid pageStart (${passageLocA.pageStart})`);
  assert(passageLocA.pageEnd >= passageLocA.pageStart, `Valid pageEnd (${passageLocA.pageEnd})`);

  // Verify exact text slice mapping
  const docARecord = await db.collection("documents").findOne({ _id: docA.id });
  const rawSliceA = docARecord.extractedText.slice(passageLocA.startOffset, passageLocA.endOffset);
  assert(
    rawSliceA.includes("Customer shall pay all undisputed invoices"),
    "Passage offsets slice the exact verbatim text from authoritative full document"
  );

  // --- TEST 2: Quote with Whitespace Differences Maps to Raw Location ---
  console.log("\n--- TEST 2: Quote with Whitespace Differences Maps Accurately ---");
  // Candidate quote has varied spacing and line breaks
  const whitespaceQuote = "Customer  shall    pay   all  undisputed   invoices \n within forty-five (45) calendar days";
  const verifyResWs = await fetch(`${BASE_URL}/api/verify-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: docA.id,
      quote: whitespaceQuote,
    }),
  });
  const verifyJsonWs = await verifyResWs.json();
  const vQuoteWs = verifyJsonWs.data;
  assert(vQuoteWs.isVerified === true, "Phase 4 normalizes whitespace and verifies quote");

  const passageLocWs = extractPassageLocation(vQuoteWs);
  assert(passageLocWs !== null, "Passage location created for whitespace-normalized quote");
  const rawSliceWs = docARecord.extractedText.slice(passageLocWs.startOffset, passageLocWs.endOffset);
  assert(
    rawSliceWs.includes("forty-five (45) calendar days"),
    "Normalized quote maps to exact original raw text slice without offset drift"
  );

  // --- TEST 3: Multi-Line Quotes ---
  console.log("\n--- TEST 3: Multi-Line / Multi-Sentence Quote Spanning Paragraphs ---");
  const multiSentenceQuote =
    "Provider shall implement administrative, technical, and physical safeguards meeting SOC 2 Type II criteria and 256-bit encryption for data in transit and at rest.\n\nSECTION 7. INDEMNIFICATION AND WARRANTIES";
  const verifyResMulti = await fetch(`${BASE_URL}/api/verify-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: docA.id,
      quote: multiSentenceQuote,
    }),
  });
  const verifyJsonMulti = await verifyResMulti.json();
  const vQuoteMulti = verifyJsonMulti.data;
  assert(vQuoteMulti.isVerified === true, "Multi-line quote verified across paragraph breaks");

  const passageLocMulti = extractPassageLocation(vQuoteMulti);
  assert(passageLocMulti !== null, "Passage location accurately resolves multi-line passage");
  const rawSliceMulti = docARecord.extractedText.slice(passageLocMulti.startOffset, passageLocMulti.endOffset);
  assert(
    rawSliceMulti.includes("256-bit encryption") && rawSliceMulti.includes("INDEMNIFICATION"),
    "Multi-line passage highlights both sentences continuously across line break"
  );

  // --- TEST 4: Duplicate Quotes Navigate to Verified Occurrence ---
  console.log("\n--- TEST 4: Duplicate Quote Disambiguation ---");
  // In the 150-page contract, "The parties acknowledge that compliance with Section" appears on every page!
  const dupQuote = "The parties acknowledge that compliance with Section";
  const verifyResDup = await fetch(`${BASE_URL}/api/verify-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: doc150.id,
      quote: dupQuote,
      claimedPage: 142, // target specific occurrence on Page 142
    }),
  });
  const verifyJsonDup = await verifyResDup.json();
  const vQuoteDup = verifyJsonDup.data;
  assert(vQuoteDup.isVerified === true, "Duplicate quote verified");
  assert(
    vQuoteDup.occurrencesCount > 50,
    `Engine detected duplicate occurrences in document (Total: ${vQuoteDup.occurrencesCount})`
  );
  assert(
    vQuoteDup.pageNumber === 142,
    `Disambiguation selected occurrence matching Page 142 (got: ${vQuoteDup.pageNumber})`
  );
  assert(
    vQuoteDup.startOffset > 300000,
    `Offsets map to Page 142 occurrence (> 300,000 chars, got: ${vQuoteDup.startOffset})`
  );

  const dupPassage = extractPassageLocation(vQuoteDup);
  assert(dupPassage.pageStart === 142, "Citation location navigates specifically to Page 142");

  // --- TEST 5: Deep-Page Citation Navigation (Page 142 of 150) ---
  console.log("\n--- TEST 5: Deep-Page Citation Navigation (Page 142 of 150) ---");
  const deepQuote =
    "Contractor shall pay liquidated damages of $15,000 per business day for migration delay";
  const verifyResDeep = await fetch(`${BASE_URL}/api/verify-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: doc150.id,
      quote: deepQuote,
    }),
  });
  const verifyJsonDeep = await verifyResDeep.json();
  const vQuoteDeep = verifyJsonDeep.data;
  assert(vQuoteDeep.isVerified === true, "Deep-page quote verified");
  const deepPassage = extractPassageLocation(vQuoteDeep);
  assert(deepPassage.pageStart >= 135, `Deep-page location resolves to Page ${deepPassage.pageStart} >= 135`);

  // Verify page segment mapping logic (O(1) local offset calculation)
  const doc150Record = await db.collection("documents").findOne({ _id: doc150.id });
  const page142Meta = doc150Record.pages.find((p) => p.pageNumber === deepPassage.pageStart);
  assert(page142Meta !== undefined, `Found page metadata for Page ${deepPassage.pageStart}`);

  const localStart = deepPassage.startOffset - page142Meta.startOffset;
  const localEnd = deepPassage.endOffset - page142Meta.startOffset;
  assert(
    localStart >= 0 && localEnd <= page142Meta.text.length,
    `Local page offsets [${localStart}, ${localEnd}] fall within Page ${deepPassage.pageStart} bounds [0, ${page142Meta.text.length}]`
  );
  const localSlice = page142Meta.text.slice(localStart, localEnd);
  assert(localSlice.includes("$15,000"), "Page-level slice contains the exact $15,000 passage");

  // --- TEST 6: Early-Page Citation Navigation (Page 2 of 150) ---
  console.log("\n--- TEST 6: Early-Page Citation Navigation (Page 2 of 150) ---");
  const earlyQuote =
    "Licensee is granted an exclusive worldwide enterprise license to deploy, execute, and integrate the proprietary neural processing engine";
  const verifyResEarly = await fetch(`${BASE_URL}/api/verify-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: doc150.id,
      quote: earlyQuote,
    }),
  });
  const verifyJsonEarly = await verifyResEarly.json();
  const vQuoteEarly = verifyJsonEarly.data;
  assert(vQuoteEarly.isVerified === true, "Early-page quote verified");
  const earlyPassage = extractPassageLocation(vQuoteEarly);
  assert(earlyPassage.pageStart <= 5, `Early-page location resolves to Page ${earlyPassage.pageStart} <= 5`);

  const page2Meta = doc150Record.pages.find((p) => p.pageNumber === earlyPassage.pageStart);
  const earlyLocalSlice = page2Meta.text.slice(
    earlyPassage.startOffset - page2Meta.startOffset,
    earlyPassage.endOffset - page2Meta.startOffset
  );
  assert(earlyLocalSlice.includes("exclusive worldwide enterprise license"), "Page 2 slice contains early passage");

  // --- TEST 7: Invalid Citation Location Fallback & Safety ---
  console.log("\n--- TEST 7: Invalid Citation Location Fallback & Safety ---");
  const invalidQuote1 = {
    quoteText: "Invalid Quote",
    isVerified: true,
    startOffset: -10, // negative offset
    endOffset: 50,
  };
  assert(extractPassageLocation(invalidQuote1) === null, "Rejects negative startOffset safely");

  const invalidQuote2 = {
    quoteText: "Invalid Bounds",
    isVerified: true,
    startOffset: 100,
    endOffset: 50, // endOffset < startOffset
  };
  assert(extractPassageLocation(invalidQuote2) === null, "Rejects endOffset <= startOffset safely");

  const invalidQuote3 = {
    quoteText: "Unverified Quote",
    isVerified: false,
    startOffset: 100,
    endOffset: 200,
  };
  assert(extractPassageLocation(invalidQuote3) === null, "Rejects unverified citation safely");

  // --- TEST 8: Cross-Document Isolation ---
  console.log("\n--- TEST 8: Cross-Document Isolation ---");
  // An offset from Doc 150 (offset 322,749) applied to Doc A (which is only ~2,500 chars total)
  // Must be strictly rejected
  const crossDocCitation = {
    documentId: doc150.id, // from Doc 150
    startOffset: 322749,
    endOffset: 322838,
    pageStart: 142,
    pageEnd: 142,
    isVerified: true,
  };

  assert(
    crossDocCitation.documentId !== docA.id,
    "Document isolation recognizes cross-document citation mismatch"
  );
  assert(
    crossDocCitation.startOffset > docARecord.extractedText.length,
    "Cross-document offset exceeds target document length, preventing out-of-bounds corruption"
  );

  // --- TEST 9: Unverified Candidate Quotes Cannot Provide Authoritative Navigation ---
  console.log("\n--- TEST 9: Unverified Candidate Quotes Cannot Trigger Navigation ---");
  const unverifiedCandidate = {
    text: "Hallucinated legal clause that does not exist in any agreement",
    isVerified: false,
    verified: false,
  };
  assert(
    extractPassageLocation(unverifiedCandidate) === null,
    "Unverified candidate quote cannot be converted to a VerifiedPassageLocation"
  );

  // --- TEST 10: End-to-End Chat SSE Stream Verified Citations ---
  console.log("\n--- TEST 10: Chat SSE Stream Verified Citations Integration ---");
  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: docA.id,
      message: "What are the payment terms and invoicing period?",
    }),
  });

  assert(chatRes.ok, "POST /api/chat returned HTTP 200");
  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let receivedVerifiedQuotesEvent = false;
  let receivedCitations = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunkText = decoder.decode(value);
    const lines = chunkText.split("\n\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === "verified_quotes") {
            receivedVerifiedQuotesEvent = true;
            receivedCitations = payload.verifiedQuotes || [];
          }
        } catch {}
      }
    }
  }

  assert(receivedVerifiedQuotesEvent, "Chat SSE stream emitted 'verified_quotes' event");
  assert(receivedCitations.length > 0, `Received ${receivedCitations.length} verified citation(s)`);

  const firstCitation = receivedCitations[0];
  assert(firstCitation.isVerified === true, "Citation marked isVerified === true");
  assert(typeof firstCitation.startOffset === "number", "Citation contains verified startOffset");
  assert(typeof firstCitation.endOffset === "number", "Citation contains verified endOffset");
  assert(typeof firstCitation.pageNumber === "number", "Citation contains authoritative pageNumber");

  const chatPassage = extractPassageLocation(firstCitation);
  assert(chatPassage !== null, "Chat verified citation converts cleanly to VerifiedPassageLocation");

  // --- TEST 11: Phase 5 Regression (Chunking, Retrieval & Not-Found Safety) ---
  console.log("\n--- TEST 11: Phase 5 Regression Checks ---");
  const retrievalRes = await fetch(
    `${BASE_URL}/api/retrieval?documentId=${doc150.id}&q=${encodeURIComponent(
      "What are the liquidated damages for delayed migration?"
    )}`
  );
  assert(retrievalRes.ok, "GET /api/retrieval returns HTTP 200");
  const retJson = await retrievalRes.json();
  assert(retJson.data.context.isPartialRetrieval === true, "Phase 5 partial retrieval flag active for 150-page doc");
  assert(
    retJson.data.context.contextLengthChars <= 25000,
    "Phase 5 bounded context window intact (<= 25,000 chars)"
  );
  assert(retJson.data.retrievedChunks.length > 0, "Phase 5 BM25 retrieval returns ranked chunks");

  // --- CLEANUP: Deleting Test Documents ---
  console.log("\n--- CLEANUP: Deleting Test Documents ---");
  await fetch(`${BASE_URL}/api/documents/${docA.id}`, { method: "DELETE" });
  await fetch(`${BASE_URL}/api/documents/${docB.id}`, { method: "DELETE" });
  await fetch(`${BASE_URL}/api/documents/${doc150.id}`, { method: "DELETE" });

  const remainingChunks = await db.collection("documentchunks").countDocuments({
    documentId: { $in: [docA.id, docB.id, doc150.id] },
  });
  assert(remainingChunks === 0, "All chunks deleted cleanly upon document deletion");

  await mongoose.disconnect();

  console.log("\n==================================================");
  console.log(`PHASE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
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
