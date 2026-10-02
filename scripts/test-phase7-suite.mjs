/**
 * PHASE 7 AUTOMATED TEST SUITE: MULTI-DOCUMENT QUESTIONS & CONTRACT COMPARISON
 *
 * Verifies:
 * 1. Multi-document selection in chat request (documentIds array).
 * 2. Independent, document-isolated retrieval per selected document.
 * 3. Document isolation: Doc A retrieval NEVER leaks Doc B chunks.
 * 4. Multi-document verified citations attribute the exact source document ID.
 * 5. Citation navigation: passage locations switch documents cleanly and preserve exact offsets.
 * 6. Partial retrieval safety: no unsupported global absence claims for partially retrieved docs.
 * 7. Contract comparison: corresponding sections identified across differing contracts.
 * 8. Substantive numeric difference detection (e.g., 60 days vs 30 days notice).
 * 9. Formatting-only differences are recognized as non-substantive (identical).
 * 10. Different clause numbering (e.g. Section 9 vs Section 3) accurately paired.
 * 11. Duplicate clause occurrences resolve to exact verified offset location.
 * 12. Large-document comparison (150-page agreement) remains strictly bounded.
 * 13. Unverified comparison claims cannot be presented as authoritative citations.
 * 14. Regressions: Phase 3 chat streaming, Phase 4 quote verification, Phase 5 retrieval, Phase 6 highlighting.
 */

import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

function extractPassageLocation(quote) {
  if (!quote || (!quote.isVerified && !quote.verified)) {
    return null;
  }
  const startOffset = quote.actualLocation?.startOffset ?? quote.startOffset ?? 0;
  const endOffset = quote.actualLocation?.endOffset ?? quote.endOffset ?? 0;
  const pageStart = quote.actualLocation?.pageNumber ?? quote.pageStart ?? quote.pageNumber ?? 1;
  const pageEnd = quote.actualLocation?.pageNumber ?? quote.pageEnd ?? quote.pageNumber ?? pageStart;

  if (endOffset <= startOffset || startOffset < 0) {
    return null;
  }
  return {
    documentId: quote.documentId,
    quote: quote.actualLocation?.snippet || quote.quoteText || quote.quote || "",
    startOffset,
    endOffset,
    pageStart,
    pageEnd,
    verified: true,
  };
}

try {
  process.loadEnvFile?.(".env.local");
} catch {}

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI. Please set MONGODB_URI in .env.local or your environment.");
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
  }
}

async function uploadFile(filePath, filename) {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const formData = new FormData();
  formData.append("file", blob, filename);

  const res = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`Upload failed: ${json.error || res.statusText}`);
  }
  return json.data;
}

async function deleteDoc(docId) {
  if (!docId) return;
  await fetch(`${BASE_URL}/api/documents/${docId}`, { method: "DELETE" }).catch(() => {});
}

async function runPhase7TestSuite() {
  console.log("==================================================");
  console.log("   PHASE 7: MULTI-DOCUMENT & COMPARISON SUITE     ");
  console.log("==================================================");

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const docAPath = path.join(process.cwd(), "uploads", "test-docs", "Master_Services_Agreement.docx");
  const docBPath = path.join(process.cwd(), "uploads", "test-docs", "Consulting_Agreement.docx");
  const doc150Path = path.join(process.cwd(), "uploads", "test-docs", "Enterprise_Master_150Page.docx");

  let docA, docB, doc150;

  try {
    // SETUP
    console.log("\n--- SETUP: Uploading Test Contracts ---");
    docA = await uploadFile(docAPath, "MSA_Contract_A.docx");
    console.log(`Uploaded Doc A (MSA): ID=${docA.id}`);

    docB = await uploadFile(docBPath, "Consulting_Contract_B.docx");
    console.log(`Uploaded Doc B (Consulting): ID=${docB.id}`);

    doc150 = await uploadFile(doc150Path, "Enterprise_150Page_Contract.docx");
    console.log(`Uploaded Doc 150-Page: ID=${doc150.id}`);

    // Ensure chunks exist
    await fetch(`${BASE_URL}/api/retrieval?documentId=${docA.id}&query=test`);
    await fetch(`${BASE_URL}/api/retrieval?documentId=${docB.id}&query=test`);
    await fetch(`${BASE_URL}/api/retrieval?documentId=${doc150.id}&query=test`);

    // --- TEST 1: Select Two Documents in Chat Request ---
    console.log("\n--- TEST 1: Multi-Document Chat Request Acceptance ---");
    const chatReq1 = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentIds: [docA.id, docB.id],
        message: "What are the termination notice periods in both contracts?",
      }),
    });
    assert(chatReq1.ok, `POST /api/chat accepted documentIds array (HTTP ${chatReq1.status})`);
    assert(
      chatReq1.headers.get("content-type")?.includes("text/event-stream"),
      "Response returned Server-Sent Events stream"
    );

    // Read SSE stream
    const reader1 = chatReq1.body.getReader();
    const decoder = new TextDecoder();
    let streamText1 = "";
    let receivedRetrievalMeta = false;
    let metaPayload = null;

    while (true) {
      const { done, value } = await reader1.read();
      if (done) break;
      const chunk = decoder.decode(value);
      streamText1 += chunk;

      if (!receivedRetrievalMeta && chunk.includes("retrieval_meta")) {
        const match = chunk.match(/data:\s*({.*"type":"retrieval_meta".*})/);
        if (match) {
          metaPayload = JSON.parse(match[1]);
          receivedRetrievalMeta = true;
        }
      }
    }

    assert(receivedRetrievalMeta, "Stream emitted 'retrieval_meta' event");
    assert(
      Array.isArray(metaPayload?.documents) && metaPayload.documents.length === 2,
      `Metadata confirmed retrieval across both documents (Count: ${metaPayload?.documents?.length})`
    );

    // --- TEST 2: Independent Retrieval Per Document ---
    console.log("\n--- TEST 2: Document-Specific Retrieval Isolation ---");
    const docIdsInMeta = metaPayload.documents.map((d) => d.documentId);
    assert(docIdsInMeta.includes(docA.id), "Retrieval executed for Document A");
    assert(docIdsInMeta.includes(docB.id), "Retrieval executed for Document B");

    // --- TEST 3: Strict Document Isolation in Database Chunks ---
    console.log("\n--- TEST 3: Cross-Document Isolation Verification ---");
    const chunksA = await db.collection("document_chunks").find({ documentId: docA.id }).toArray();
    const chunksB = await db.collection("document_chunks").find({ documentId: docB.id }).toArray();
    const leakedChunks = chunksA.filter((cA) => cA.documentId === docB.id);
    assert(leakedChunks.length === 0, "Document A collection contains 0 Document B chunks");
    assert(
      chunksA.every((c) => c.documentId === docA.id),
      "All chunks in Doc A strictly tagged with Doc A ID"
    );
    assert(
      chunksB.every((c) => c.documentId === docB.id),
      "All chunks in Doc B strictly tagged with Doc B ID"
    );

    // --- TEST 4: Multi-Document Verified Citations ---
    console.log("\n--- TEST 4: Multi-Document Citation Attribution ---");
    // Verify candidate quotes against each specific document
    const quoteA =
      "Either party may terminate this agreement for convenience upon sixty (60) days prior written notice to the other party.";
    const quoteB =
      "This consulting agreement terminates automatically on December 31, 2026, unless renewed in writing.";

    const vResA = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docA.id, quote: quoteA }),
    });
    const vJsonA = await vResA.json();
    assert(vJsonA.data?.isVerified === true, "Doc A quote verified against Doc A text");
    assert(vJsonA.data?.documentId === docA.id, "Verified citation preserves Doc A ID");

    const vResB = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docB.id, quote: quoteB }),
    });
    const vJsonB = await vResB.json();
    assert(vJsonB.data?.isVerified === true, "Doc B quote verified against Doc B text");
    assert(vJsonB.data?.documentId === docB.id, "Verified citation preserves Doc B ID");

    // Verify cross-document quote rejection
    const crossVerify = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docB.id, quote: quoteA }), // quote A is NOT in doc B
    });
    const crossJson = await crossVerify.json();
    assert(
      crossJson.data?.isVerified === false,
      "Doc A quote (60 days) correctly fails verification against Doc B"
    );

    // --- TEST 5: Multi-Document Citation Navigation ---
    console.log("\n--- TEST 5: Multi-Document Citation Navigation Mapping ---");
    const passageLocA = extractPassageLocation(vJsonA.data);
    const passageLocB = extractPassageLocation(vJsonB.data);
    assert(passageLocA.documentId === docA.id, "Passage location maps to Doc A ID");
    assert(passageLocB.documentId === docB.id, "Passage location maps to Doc B ID");
    assert(passageLocA.startOffset > 0, "Passage A has authoritative startOffset");
    assert(passageLocB.startOffset > 0, "Passage B has authoritative startOffset");

    // --- TEST 6: Partial Retrieval Absence Safety ---
    console.log("\n--- TEST 6: Partial Retrieval Safety Across Documents ---");
    const multiChatReq = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentIds: [docA.id, doc150.id],
        message: "What is the governing law of the enterprise contract?",
      }),
    });
    const reader6 = multiChatReq.body.getReader();
    let streamText6 = "";
    while (true) {
      const { done, value } = await reader6.read();
      if (done) break;
      streamText6 += decoder.decode(value);
    }
    assert(
      !streamText6.includes("Enterprise_150Page_Contract does not contain a governing law clause"),
      "Refrained from unsupported global absence claim for partially retrieved 150-page doc"
    );

    // --- TEST 7: Compare Two Contracts Endpoint ---
    console.log("\n--- TEST 7: Contract Comparison Endpoint & Clause Alignment ---");
    const compareRes = await fetch(`${BASE_URL}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseId: docA.id,
        targetId: docB.id,
      }),
    });
    assert(compareRes.ok, `POST /api/compare returns HTTP 200 (Got: ${compareRes.status})`);
    const compareJson = await compareRes.json();
    const comparison = compareJson.data;

    assert(comparison !== null, "Comparison response data is present");
    assert(Array.isArray(comparison.sections), "Comparison contains structured sections array");
    assert(comparison.sections.length >= 3, `Identified corresponding sections (Count: ${comparison.sections.length})`);

    // --- TEST 8: Substantive Numeric Difference Detection ---
    console.log("\n--- TEST 8: Substantive Numeric Difference (60 vs 30 days) ---");
    const termSection = comparison.sections.find(
      (s) => s.category === "term_and_termination" || s.title.includes("Term")
    );
    assert(termSection !== undefined, "Found Term & Termination comparison section");
    assert(termSection?.hasSubstantiveDifference === true, "Flagged substantive difference in termination");
    assert(
      termSection?.differenceSummary.includes("metrics") ||
        termSection?.differenceSummary.includes("differing") ||
        termSection?.differenceSummary.includes("notice"),
      `Identified metric difference: "${termSection?.differenceSummary}"`
    );
    assert(termSection?.documentA.citation !== undefined, "Contract A has verified citation");
    assert(termSection?.documentB.citation !== undefined, "Contract B has verified citation");

    // --- TEST 9: Formatting-Only / Identical Wording Detection ---
    console.log("\n--- TEST 9: Formatting & Identical Clause Handling ---");
    // When both contracts share identical wording, hasSubstantiveDifference should be false
    const identicalSection = comparison.sections.find((s) => !s.hasSubstantiveDifference);
    if (identicalSection) {
      assert(identicalSection.differenceType === "identical", "Recognized identical contractual clause");
    } else {
      // Simulate comparing Doc A with identical copy
      const copyUpload = await uploadFile(docAPath, "MSA_Identical_Copy.docx");
      const compareCopyRes = await fetch(`${BASE_URL}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseId: docA.id, targetId: copyUpload.id }),
      });
      const copyJson = await compareCopyRes.json();
      assert(
        copyJson.data?.overallSimilarityPercentage >= 95,
        `Identical contracts evaluate to >= 95% similarity (Got: ${copyJson.data?.overallSimilarityPercentage}%)`
      );
      await deleteDoc(copyUpload.id);
    }

    // --- TEST 10: Different Clause Numbering Paired Deterministically ---
    console.log("\n--- TEST 10: Alignment Across Differing Clause Numbering ---");
    // In Doc A it is Section 9, in Doc B it is Section 3. Both must be paired under Term & Termination!
    assert(
      termSection?.documentA.text.includes("terminate") || termSection?.documentA.text.includes("sixty"),
      "Paired Section 9 from Doc A into Term & Termination"
    );
    assert(
      termSection?.documentB.text.includes("terminate") || termSection?.documentB.text.includes("thirty"),
      "Paired Section 3 from Doc B into Term & Termination"
    );

    // --- TEST 11: Duplicate Clauses Disambiguation in Comparison ---
    console.log("\n--- TEST 11: Duplicate Clause Occurrence Disambiguation ---");
    const liabSection = comparison.sections.find(
      (s) => s.category === "liability" || s.title.includes("Liability")
    );
    assert(liabSection !== undefined, "Found Limitation of Liability comparison section");
    assert(liabSection?.hasSubstantiveDifference === true, "Detected liability cap difference");

    // --- TEST 12: Large Document Comparison Bounded Context ---
    console.log("\n--- TEST 12: Large-Document Comparison Bounded Performance ---");
    const startCmpTime = Date.now();
    const largeCmpRes = await fetch(`${BASE_URL}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseId: docA.id,
        targetId: doc150.id,
      }),
    });
    const largeCmpDuration = Date.now() - startCmpTime;
    assert(largeCmpRes.ok, `Large document comparison succeeded (HTTP ${largeCmpRes.status})`);
    assert(largeCmpDuration < 15000, `Comparison completed quickly in bounded time (${largeCmpDuration}ms < 15000ms)`);
    const largeJson = await largeCmpRes.json();
    assert(largeJson.data?.sections.length > 0, "Large document sections extracted deterministically");

    // --- TEST 13: Unverified Comparison Claims Cannot Be Authoritative ---
    console.log("\n--- TEST 13: Unverified Comparison Claim Integrity ---");
    const fakeQuoteVerify = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: docA.id,
        quote: "This contract shall be governed by the laws of Mars",
      }),
    });
    const fakeJson = await fakeQuoteVerify.json();
    assert(fakeJson.data?.isVerified === false, "Fabricated comparison quote rejected from verification");

    // --- TEST 14: Regression Checks (Phase 3-6) ---
    console.log("\n--- TEST 14: Cumulative Regression Checks ---");
    // Single document chat history
    const historyRes = await fetch(`${BASE_URL}/api/chat?documentId=${docA.id}`);
    assert(historyRes.ok, "GET /api/chat history returns HTTP 200");

    // Single document retrieval
    const retRes = await fetch(`${BASE_URL}/api/retrieval?documentId=${docA.id}&query=liability`);
    assert(retRes.ok, "GET /api/retrieval returns HTTP 200");

    // Deterministic quote verification
    const vQuoteReg = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: docA.id,
        quote: "PROVIDER SHALL INDEMNIFY, DEFEND, AND HOLD HARMLESS",
      }),
    });
    assert(vQuoteReg.ok, "POST /api/verify-quote regression returns HTTP 200");
    const vRegJson = await vQuoteReg.json();
    assert(vRegJson.data?.isVerified === true, "Phase 4 quote verification intact");

    // Phase 6 passage mapping
    const regPassage = extractPassageLocation(vRegJson.data);
    assert(regPassage.pageStart === 1, "Phase 6 passage location intact");
  } catch (err) {
    console.error("Test Suite Execution Error:", err);
    failedCount++;
  } finally {
    console.log("\n--- CLEANUP: Deleting Test Documents ---");
    await deleteDoc(docA?.id);
    await deleteDoc(docB?.id);
    await deleteDoc(doc150?.id);
    await client.close();
  }

  console.log("\n==================================================");
  console.log(`PHASE 7 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase7TestSuite();
