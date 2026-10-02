/**
 * Comprehensive Phase 4 Test Suite
 * Tests deterministic quote verification engine against all 14 requirements in Section 15
 */

const BASE_URL = "http://localhost:3000";
const PDF_DOC_ID = "doc_1790847139404_tsyn0j"; // NDA_Acme_Beta.pdf
const DOCX_DOC_ID = "doc_1790847139573_bagfe7"; // CloudScale_License.docx

// Mirror of core normalization function for local algorithmic verification
function buildNormalizedIndex(rawText) {
  if (!rawText) return { normalizedText: "", normToOrigMap: [] };
  let normalizedText = "";
  const normToOrigMap = [];
  let i = 0;
  const len = rawText.length;

  while (i < len) {
    const ch = rawText[i];
    if (/[\s\u00A0\u2000-\u200B\uFEFF]/.test(ch)) {
      const whitespaceStart = i;
      while (i < len && /[\s\u00A0\u2000-\u200B\uFEFF]/.test(rawText[i])) {
        i++;
      }
      if (normalizedText.length > 0) {
        normalizedText += " ";
        normToOrigMap.push(whitespaceStart);
      }
    } else {
      let normChar = ch;
      if (/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/.test(ch)) normChar = '"';
      else if (/[\u2018\u2019\u201A\u201B\u0060\u00B4]/.test(ch)) normChar = "'";
      else if (/[\u2014\u2013\u2015\u2212]/.test(ch)) normChar = "-";

      normalizedText += normChar;
      normToOrigMap.push(i);
      i++;
    }
  }

  if (normalizedText.endsWith(" ")) {
    normalizedText = normalizedText.slice(0, -1);
    normToOrigMap.pop();
  }

  return { normalizedText, normToOrigMap };
}

function normalizeCandidateQuote(quote) {
  if (!quote) return "";
  let clean = quote.trim();
  if (
    (clean.startsWith('"') && clean.endsWith('"') && clean.length > 1) ||
    (clean.startsWith("'") && clean.endsWith("'") && clean.length > 1) ||
    (clean.startsWith("\u201C") && clean.endsWith("\u201D") && clean.length > 1) ||
    (clean.startsWith("\u2018") && clean.endsWith("\u2019") && clean.length > 1)
  ) {
    clean = clean.slice(1, -1).trim();
  }
  return clean
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'")
    .replace(/[\u2014\u2013\u2015\u2212]/g, "-")
    .replace(/[\s\u00A0\u2000-\u200B\uFEFF]+/g, " ")
    .trim();
}

function resolvePageLocation(startOffset, endOffset, pages) {
  if (!pages || pages.length === 0) return { pageStart: 1, pageEnd: 1, pageNumber: 1 };
  let pageStart = 1;
  for (const p of pages) {
    const pStart = p.startOffset ?? 0;
    const pEnd = p.endOffset ?? pStart + (p.text?.length || 0);
    if (startOffset >= pStart && startOffset <= pEnd) {
      pageStart = p.pageNumber;
      break;
    }
    if (startOffset < pStart) {
      pageStart = Math.max(1, p.pageNumber - 1);
      break;
    }
    pageStart = p.pageNumber;
  }
  const lastChar = Math.max(startOffset, endOffset - 1);
  let pageEnd = pageStart;
  for (const p of pages) {
    const pStart = p.startOffset ?? 0;
    const pEnd = p.endOffset ?? pStart + (p.text?.length || 0);
    if (lastChar >= pStart && lastChar <= pEnd) {
      pageEnd = p.pageNumber;
      break;
    }
    if (lastChar < pStart) {
      pageEnd = Math.max(pageStart, p.pageNumber - 1);
      break;
    }
    pageEnd = p.pageNumber;
  }
  if (pageEnd < pageStart) pageEnd = pageStart;
  return { pageStart, pageEnd, pageNumber: pageStart };
}

async function runPhase4Tests() {
  console.log("==================================================");
  console.log("       PHASE 4: VERIFIED QUOTE ENGINE TESTS       ");
  console.log("==================================================\n");

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

  // --- UNIT VERIFICATION TESTS (ALGORITHMIC PRECISION) ---

  console.log("--- TEST 1: Exact Quote Exists ---");
  {
    const sampleDoc = "MUTUAL CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT\n2. Governing Law: This agreement shall be governed by Delaware jurisdiction.";
    const candidate = "2. Governing Law: This agreement shall be governed by Delaware jurisdiction.";
    const { normalizedText, normToOrigMap } = buildNormalizedIndex(sampleDoc);
    const normCand = normalizeCandidateQuote(candidate);

    const matchIdx = normalizedText.indexOf(normCand);
    assert(matchIdx !== -1, "Found candidate in normalized document text");

    const startOffset = normToOrigMap[matchIdx];
    const endOffset = normToOrigMap[matchIdx + normCand.length - 1] + 1;
    const extracted = sampleDoc.slice(startOffset, endOffset);

    assert(extracted === candidate, "Extracted raw slice perfectly matches candidate quote");
  }

  console.log("\n--- TEST 2: Whitespace Normalization (Multiple Spaces & Tabs) ---");
  {
    const sampleDoc = "The   Licensee   shall    pay\t\tthe  annual  fee.";
    const candidate = "The Licensee shall pay the annual fee.";
    const { normalizedText, normToOrigMap } = buildNormalizedIndex(sampleDoc);
    const normCand = normalizeCandidateQuote(candidate);

    const matchIdx = normalizedText.indexOf(normCand);
    assert(matchIdx !== -1, "Matched quote with collapsed spaces and tabs");

    const startOffset = normToOrigMap[matchIdx];
    const endOffset = normToOrigMap[matchIdx + normCand.length - 1] + 1;
    assert(
      sampleDoc.slice(startOffset, endOffset) === sampleDoc,
      "Offsets map accurately back to raw text with original tabs and spaces"
    );
  }

  console.log("\n--- TEST 3: Line Breaks & Paragraph Breaks Normalization ---");
  {
    const sampleDoc = "Section 4. Termination.\nEither party may terminate\r\nupon thirty (30) days\nwritten notice.";
    const candidate = "Either party may terminate upon thirty (30) days written notice.";
    const { normalizedText, normToOrigMap } = buildNormalizedIndex(sampleDoc);
    const normCand = normalizeCandidateQuote(candidate);

    const matchIdx = normalizedText.indexOf(normCand);
    assert(matchIdx !== -1, "Matched quote across newlines and CRLF line breaks");

    const startOffset = normToOrigMap[matchIdx];
    const endOffset = normToOrigMap[matchIdx + normCand.length - 1] + 1;
    assert(
      sampleDoc.slice(startOffset, endOffset) === "Either party may terminate\r\nupon thirty (30) days\nwritten notice.",
      "Offsets map accurately back to raw text preserving original newlines"
    );
  }

  console.log("\n--- TEST 4 & 5: Non-Existent & Hallucinated AI Quotes ---");
  {
    const sampleDoc = "This is a simple non-disclosure agreement regarding trade secrets.";
    const fakeQuote = "Licensor grants Licensee an exclusive irrevocable worldwide patent license.";
    const { normalizedText } = buildNormalizedIndex(sampleDoc);
    const normCand = normalizeCandidateQuote(fakeQuote);
    assert(normalizedText.indexOf(normCand) === -1, "Hallucinated quote does not match document text");
  }

  console.log("\n--- TEST 6 & 7: Do NOT Trust AI Page Numbers ---");
  {
    const sampleDoc = "Page 1 Content: Confidentiality terms.\n\nPage 2 Content: Governing law Delaware.";
    const pages = [
      { pageNumber: 1, text: "Page 1 Content: Confidentiality terms.", startOffset: 0, endOffset: 38 },
      { pageNumber: 2, text: "Page 2 Content: Governing law Delaware.", startOffset: 40, endOffset: 79 },
    ];
    // AI claims page 99 for a quote on Page 2
    const { normalizedText, normToOrigMap } = buildNormalizedIndex(sampleDoc);
    const normCand = normalizeCandidateQuote("Governing law Delaware");
    const matchIdx = normalizedText.indexOf(normCand);
    const startOffset = normToOrigMap[matchIdx];
    const endOffset = normToOrigMap[matchIdx + normCand.length - 1] + 1;
    const pageLoc = resolvePageLocation(startOffset, endOffset, pages);

    assert(pageLoc.pageNumber === 2, "Page number calculated as 2, ignoring untrusted AI claim");
  }

  console.log("\n--- TEST 8: Multi-Page Quotes Spanning Page Boundaries ---");
  {
    const page1Text = "The supplier shall provide all necessary";
    const page2Text = "written notice before agreement termination.";
    const sampleDoc = page1Text + "\n\n" + page2Text;
    const pages = [
      { pageNumber: 1, text: page1Text, startOffset: 0, endOffset: page1Text.length },
      { pageNumber: 2, text: page2Text, startOffset: page1Text.length + 2, endOffset: sampleDoc.length },
    ];
    const candidate = "The supplier shall provide all necessary written notice before agreement termination.";
    const { normalizedText, normToOrigMap } = buildNormalizedIndex(sampleDoc);
    const normCand = normalizeCandidateQuote(candidate);
    const matchIdx = normalizedText.indexOf(normCand);
    const startOffset = normToOrigMap[matchIdx];
    const endOffset = normToOrigMap[matchIdx + normCand.length - 1] + 1;
    const pageLoc = resolvePageLocation(startOffset, endOffset, pages);

    assert(pageLoc.pageStart === 1, "pageStart correctly identified as 1");
    assert(pageLoc.pageEnd === 2, "pageEnd correctly identified as 2");
    assert(pageLoc.pageStart !== pageLoc.pageEnd, "Multi-page quote correctly spans pages 1 to 2");
  }

  console.log("\n--- TEST 9: Duplicate Quotes Occurring Multiple Times ---");
  {
    const sampleDoc = "Section 1: The parties agree to maintain confidentiality.\nSection 5: The parties agree to maintain confidentiality.";
    const candidate = "The parties agree to maintain confidentiality.";
    const { normalizedText, normToOrigMap } = buildNormalizedIndex(sampleDoc);
    const normCand = normalizeCandidateQuote(candidate);

    const matches = [];
    let pos = 0;
    while (pos < normalizedText.length) {
      const idx = normalizedText.indexOf(normCand, pos);
      if (idx === -1) break;
      matches.push({
        startOffset: normToOrigMap[idx],
        endOffset: normToOrigMap[idx + normCand.length - 1] + 1,
      });
      pos = idx + 1;
    }

    assert(matches.length === 2, `Found all ${matches.length} occurrences in document`);
    assert(matches[0].startOffset < matches[1].startOffset, "Occurrences ordered deterministically in document order");
  }

  // --- API INTEGRATION TESTS (AGAINST RUNNING SERVER) ---

  console.log("\n--- TEST 10, 11 & 12: API Validation & Error Handling ---");
  {
    // Empty quote
    const emptyRes = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: PDF_DOC_ID, quote: "   " }),
    });
    assert(emptyRes.status === 400, "Empty quote rejected with HTTP 400");

    // Missing documentId
    const missingDocRes = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote: "Some quote text" }),
    });
    assert(missingDocRes.status === 400, "Missing documentId rejected with HTTP 400");

    // Non-existent document
    const nonExistentRes = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: "doc_non_existent_9999", quote: "Some quote text" }),
    });
    assert(nonExistentRes.status === 404, "Non-existent document rejected with HTTP 404");
  }

  console.log("\n--- TEST 1 & 2 (via API): Real PDF & DOCX Quote Verification ---");
  {
    // Real PDF quote with smart quote / punctuation
    const pdfQuote = "2. Governing Law: This agreement shall be governed by Delaware jurisdiction.";
    const pdfRes = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: PDF_DOC_ID, quote: pdfQuote, claimedPage: 99 }),
    });

    assert(pdfRes.status === 200, "POST /api/verify-quote returns HTTP 200");
    const pdfJson = await pdfRes.json();
    assert(pdfJson.success === true, "Response success === true");
    assert(pdfJson.data.verified === true, "Real PDF quote verified");
    assert(pdfJson.data.pageNumber === 1, "Page number accurately resolved as 1 (ignoring claimedPage: 99)");
    assert(pdfJson.data.location?.startOffset !== undefined, "Valid startOffset returned");
    assert(pdfJson.data.location?.endOffset !== undefined, "Valid endOffset returned");

    // Real DOCX quote with whitespace variation
    const docxQuote = "Total  damages   shall  not  exceed  fees  paid  in the prior 12 months.";
    const docxRes = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: DOCX_DOC_ID, quote: docxQuote }),
    });
    const docxJson = await docxRes.json();
    assert(docxJson.data.verified === true, "Real DOCX quote with varied whitespace verified");
    assert(docxJson.data.location?.startOffset !== undefined, "Valid location returned for DOCX");

    // Fake quote on real doc
    const fakeRes = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: PDF_DOC_ID,
        quote: "Party shall pay an exorbitant penalty of ten million dollars.",
      }),
    });
    const fakeJson = await fakeRes.json();
    assert(fakeJson.data.verified === false, "Fake quote returns verified = false");
    assert(fakeJson.data.reason === "Quote not found in document", "Explains quote not found in document");
  }

  console.log("\n--- TEST 13: End-to-End AI Chat Integration ---");
  {
    // Clear chat
    await fetch(`${BASE_URL}/api/chat?documentId=${PDF_DOC_ID}`, { method: "DELETE" });

    // Ask question
    const chatRes = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: PDF_DOC_ID,
        message: "What is the governing law in this agreement?",
      }),
    });

    const reader = chatRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let verifiedQuotesEvent = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "verified_quotes") {
              verifiedQuotesEvent = data;
            }
          } catch {}
        }
      }
    }

    assert(
      verifiedQuotesEvent !== null,
      "Chat SSE stream emitted 'verified_quotes' event (NOT unverified candidates)"
    );
    assert(
      Array.isArray(verifiedQuotesEvent?.verifiedQuotes) && verifiedQuotesEvent.verifiedQuotes.length > 0,
      `Received ${verifiedQuotesEvent?.verifiedQuotes.length} deterministically verified quote(s)`
    );

    const firstV = verifiedQuotesEvent?.verifiedQuotes[0];
    assert(firstV.isVerified === true, "First quote is marked isVerified === true");
    assert(firstV.actualLocation?.startOffset !== undefined, "Quote has verified startOffset");
    assert(firstV.pageNumber === 1, "Quote has backend-calculated pageNumber");

    // Verify MongoDB chat history persisted verified citations
    const histRes = await fetch(`${BASE_URL}/api/chat?documentId=${PDF_DOC_ID}`);
    const histData = await histRes.json();
    const lastMsg = histData.data[histData.data.length - 1];

    assert(
      Array.isArray(lastMsg.citations) && lastMsg.citations.length > 0,
      "MongoDB persisted verified citations array in ChatMessage"
    );
    assert(
      lastMsg.citations[0].isVerified === true,
      "Persisted citation has isVerified === true"
    );
  }

  console.log("\n--- TEST 14: Security & Integrity Enforcement ---");
  {
    // Client tries to forge verification status
    const forgedRes = await fetch(`${BASE_URL}/api/verify-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: PDF_DOC_ID,
        quote: "Arbitrary forged clause never in contract",
        verified: true,
        isVerified: true,
        pageNumber: 1,
        startOffset: 0,
        endOffset: 10,
      }),
    });
    const forgedJson = await forgedRes.json();
    assert(forgedJson.data.verified === false, "Server rejected forged verified: true");
    assert(forgedJson.data.reason === "Quote not found in document", "Server confirmed quote not found in real document text");
  }

  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
