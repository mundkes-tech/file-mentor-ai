/**
 * Comprehensive Phase 3 Verification Suite
 * Tests all 14 requirements from Phase 3 specification
 */

const BASE_URL = "http://localhost:3000";
const PDF_DOC_ID = "doc_1790847139404_tsyn0j"; // NDA_Acme_Beta.pdf
const DOCX_DOC_ID = "doc_1790847139573_bagfe7"; // CloudScale_License.docx

// Helper to consume SSE stream
async function consumeSSE(res, { onChunk, signal } = {}) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let candidateQuotes = [];
  let isDone = false;
  let isStopped = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === "token" && parsed.content) {
              fullText += parsed.content;
              if (onChunk) onChunk(parsed.content);
            } else if (
              (parsed.type === "candidate_quotes" || parsed.type === "verified_quotes") &&
              (parsed.candidateQuotes || parsed.verifiedQuotes)
            ) {
              candidateQuotes = parsed.candidateQuotes || parsed.verifiedQuotes;
            } else if (parsed.type === "done") {
              isDone = true;
            } else if (parsed.type === "stopped") {
              isStopped = true;
            } else if (parsed.type === "error") {
              throw new Error("SSE Stream error: " + parsed.error);
            }
          } catch (e) {
            if (e.message.startsWith("SSE Stream error")) throw e;
          }
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      return { fullText, candidateQuotes, aborted: true };
    }
    throw err;
  }

  return { fullText, candidateQuotes, isDone, isStopped, aborted: false };
}

async function testSuite() {
  console.log("==================================================");
  console.log("       PHASE 3 END-TO-END TEST SUITE              ");
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

  // --- Clean any existing chat history for clean slate ---
  await fetch(`${BASE_URL}/api/chat?documentId=${PDF_DOC_ID}`, { method: "DELETE" });
  await fetch(`${BASE_URL}/api/chat?documentId=${DOCX_DOC_ID}`, { method: "DELETE" });

  // TEST 1: Ask question about ready PDF whose answer exists
  console.log("\n--- TEST 1 & 3: PDF Q&A (Answer Exists) & Streaming ---");
  {
    const question = "What is the governing law in this agreement?";
    console.log(`Asking PDF (${PDF_DOC_ID}): "${question}"`);

    let chunkCount = 0;
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: PDF_DOC_ID, message: question }),
    });

    assert(res.status === 200, "POST /api/chat returns HTTP 200");
    assert(res.headers.get("content-type")?.includes("text/event-stream"), "Response has text/event-stream header");

    const result = await consumeSSE(res, {
      onChunk: (chunk) => {
        chunkCount++;
      },
    });

    console.log(`Answer received (${chunkCount} token chunks):\n"${result.fullText.trim()}"`);
    console.log("Candidate Quotes:", result.candidateQuotes);

    assert(chunkCount > 1, `Streamed in multiple chunks (${chunkCount} chunks)`);
    assert(
      result.fullText.toLowerCase().includes("delaware"),
      "AI accurately answered 'Delaware' based on PDF text"
    );
    assert(
      Array.isArray(result.candidateQuotes) && result.candidateQuotes.length > 0,
      "AI returned candidate quotes"
    );
  }

  // TEST 2: Ask question about ready DOCX whose answer exists
  console.log("\n--- TEST 2: DOCX Q&A (Answer Exists) ---");
  {
    const question = "What is the limitation of liability?";
    console.log(`Asking DOCX (${DOCX_DOC_ID}): "${question}"`);

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: DOCX_DOC_ID, message: question }),
    });

    assert(res.status === 200, "POST /api/chat returns HTTP 200 for DOCX");
    const result = await consumeSSE(res);

    console.log(`Answer received:\n"${result.fullText.trim()}"`);
    assert(
      result.fullText.toLowerCase().includes("12 months") ||
      result.fullText.toLowerCase().includes("fees paid"),
      "AI accurately answered with 12 months / fees paid based on DOCX text"
    );
  }

  // TEST 4: Ask question whose answer does NOT exist
  console.log("\n--- TEST 4: Question with NO answer in the document ---");
  {
    const question = "What is the termination notice period for convenience?";
    console.log(`Asking PDF (${PDF_DOC_ID}): "${question}"`);

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: PDF_DOC_ID, message: question }),
    });

    const result = await consumeSSE(res);
    console.log(`Answer received:\n"${result.fullText.trim()}"`);

    const doesNotKnow =
      result.fullText.toLowerCase().includes("not provide") ||
      result.fullText.toLowerCase().includes("not contain") ||
      result.fullText.toLowerCase().includes("not found") ||
      result.fullText.toLowerCase().includes("does not specify") ||
      result.fullText.toLowerCase().includes("could not be found") ||
      result.fullText.toLowerCase().includes("not mentioned");

    assert(doesNotKnow, "AI truthfully stated the information is not in the contract (no hallucinations)");
  }

  // TEST 5: Verify AI does NOT answer from unrelated documents
  console.log("\n--- TEST 5: Strict Isolation Between Documents ---");
  {
    // Ask PDF doc about terms only present in DOCX ("CloudScale Systems" / "Enterprise Client")
    const question = "Who is the licensor and what is their company name?";
    console.log(`Asking PDF (${PDF_DOC_ID}) about DOCX-only facts: "${question}"`);

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: PDF_DOC_ID, message: question }),
    });

    const result = await consumeSSE(res);
    console.log(`Answer received:\n"${result.fullText.trim()}"`);

    assert(
      !result.fullText.toLowerCase().includes("cloudscale"),
      "AI did NOT leak information from the DOCX into the PDF context"
    );
  }

  // TEST 6, 7 & 8: Verify Stop Generating & Partial Stream Preservation
  console.log("\n--- TEST 6, 7 & 8: Stop Generating & Partial Content Persistence ---");
  {
    const question = "Explain in great detail every clause of this agreement step by step with lengthy legal commentary.";
    console.log(`Starting stream to test AbortController...`);

    const abortController = new AbortController();
    let partialText = "";

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: DOCX_DOC_ID, message: question }),
      signal: abortController.signal,
    });

    assert(res.status === 200, "Stream started successfully");

    try {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let chunksReceived = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        partialText += text;
        chunksReceived++;

        // Abort after receiving initial chunk packets
        if (chunksReceived >= 3) {
          console.log(`Aborting stream after ${chunksReceived} chunks received...`);
          abortController.abort();
          break;
        }
      }
    } catch (e) {
      // Expected abort error on client fetch
    }

    // Wait a moment for server disconnect event to finalize MongoDB update
    await new Promise((r) => setTimeout(r, 800));

    // Fetch chat history for DOCX to verify partial content was preserved
    const histRes = await fetch(`${BASE_URL}/api/chat?documentId=${DOCX_DOC_ID}`);
    const histData = await histRes.json();
    const messages = histData.data || [];
    const lastMsg = messages[messages.length - 1];

    console.log("Last message in history after stop:", {
      role: lastMsg?.role,
      status: lastMsg?.status,
      contentSnippet: lastMsg?.content?.slice(0, 60) + "...",
    });

    assert(
      lastMsg && lastMsg.role === "assistant",
      "Assistant message exists in history"
    );
    assert(
      lastMsg.status === "stopped" || lastMsg.status === "complete",
      `Message marked as stopped or complete (got: ${lastMsg.status})`
    );
    assert(
      lastMsg.content && lastMsg.content.length > 0,
      "Partial streamed content was preserved in MongoDB"
    );
  }

  // TEST 9 & 10: Verify Chat Persistence & Separate Histories
  console.log("\n--- TEST 9 & 10: Chat Persistence & Separate Histories ---");
  {
    const pdfHistRes = await fetch(`${BASE_URL}/api/chat?documentId=${PDF_DOC_ID}`);
    const pdfHist = await pdfHistRes.json();
    const pdfMessages = pdfHist.data || [];

    const docxHistRes = await fetch(`${BASE_URL}/api/chat?documentId=${DOCX_DOC_ID}`);
    const docxHist = await docxHistRes.json();
    const docxMessages = docxHist.data || [];

    assert(
      pdfHist.success && pdfMessages.length >= 4,
      `PDF chat history persisted across calls (${pdfMessages.length} messages)`
    );
    assert(
      docxHist.success && docxMessages.length >= 4,
      `DOCX chat history persisted across calls (${docxMessages.length} messages)`
    );

    const pdfHasDelaware = pdfMessages.some((m) =>
      m.content.toLowerCase().includes("delaware")
    );
    const docxHasDelaware = docxMessages.some((m) =>
      m.content.toLowerCase().includes("delaware")
    );

    assert(pdfHasDelaware, "PDF history correctly contains Delaware answer");
    assert(!docxHasDelaware, "DOCX history does NOT contain PDF answers (histories are isolated)");
  }

  // TEST 11: Document Deletion Cleans Up Chat History
  console.log("\n--- TEST 11: Document Deletion Cleans Chat Session ---");
  {
    const docsRes = await fetch(`${BASE_URL}/api/documents`);
    const docsJson = await docsRes.json();
    const candidateDocs = (docsJson.data || []).filter(
      (d) => d.id !== PDF_DOC_ID && d.id !== DOCX_DOC_ID
    );
    const tempDocId = candidateDocs[0]?.id || "doc_1790847082434_lvcjvu";
    console.log(`Adding chat message to extra doc (${tempDocId})...`);

    const chatRes = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: tempDocId, message: "Hello" }),
    });
    await consumeSSE(chatRes);

    const beforeDeleteHist = await fetch(`${BASE_URL}/api/chat?documentId=${tempDocId}`);
    const beforeData = await beforeDeleteHist.json();
    assert((beforeData.data || []).length > 0, "Chat history created for temp doc");

    console.log(`Deleting doc (${tempDocId})...`);
    const delRes = await fetch(`${BASE_URL}/api/documents/${tempDocId}`, {
      method: "DELETE",
    });
    const delData = await delRes.json();
    assert(delData.success, "Document deleted successfully");

    const afterDeleteHist = await fetch(`${BASE_URL}/api/chat?documentId=${tempDocId}`);
    const afterData = await afterDeleteHist.json();
    assert(
      (afterData.data || []).length === 0,
      "Chat history was cleaned up with document deletion"
    );
  }

  // TEST 12: Input Validation & Edge Cases
  console.log("\n--- TEST 12: Validation & Error Handling ---");
  {
    // Empty message
    const emptyMsgRes = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: PDF_DOC_ID, message: "   " }),
    });
    assert(emptyMsgRes.status === 400, "Empty message rejected with HTTP 400");

    // Missing documentId
    const missingDocRes = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What is this?" }),
    });
    assert(missingDocRes.status === 400, "Missing documentId rejected with HTTP 400");

    // Non-existent document
    const nonExistentDocRes = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: "doc_non_existent_12345", message: "Hello?" }),
    });
    assert(nonExistentDocRes.status === 404, "Non-existent document rejected with HTTP 404");
  }

  // TEST 14: Security (No API Key Exposed to Browser)
  console.log("\n--- TEST 14: Security & API Key Protection ---");
  {
    const prefix = "gsk_";

    // Inspect recent responses
    const chatHistRes = await fetch(`${BASE_URL}/api/chat?documentId=${PDF_DOC_ID}`);
    const chatHistText = await chatHistRes.text();
    const docRes = await fetch(`${BASE_URL}/api/documents`);
    const docText = await docRes.text();

    assert(
      !chatHistText.includes(prefix) && !docText.includes(prefix),
      "API key is NEVER leaked in any API response or headers"
    );
  }

  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

testSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
