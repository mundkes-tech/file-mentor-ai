/**
 * PHASE 8 AUTOMATED TEST SUITE: PART C — TRACKED-CHANGE REDLINING
 *
 * Verifies:
 * 1. Valid Original DOCX + Updated DOCX produces a redlined DOCX.
 * 2. Addition: Text present in Updated but not Original is represented as an addition.
 * 3. Deletion: Text present in Original but not Updated is represented as a deletion.
 * 4. Modification: Text changed between versions is represented with diff (substantive changes).
 * 5. Formatting-only change: Does not produce excessive false substantive changes.
 * 6. Invalid PDF input: Rejected safely with HTTP 400.
 * 7. Empty document: Handled safely with HTTP 400 without crashing.
 * 8. Large DOCX: Processing 150-page DOCX completes reliably without out-of-memory or timeout.
 * 9. Original file integrity: Original document remains strictly untouched on disk.
 * 10. Updated file integrity: Updated document remains strictly untouched on disk.
 * 11. Output validity: Generated redline file is a valid .docx that can be opened and parsed by Mammoth.
 * 12. Security: Path traversal attempts cannot escape controlled storage.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import mammoth from "mammoth";
import { Document, Paragraph, Packer } from "docx";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

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

/**
 * Helper to generate a minimal in-memory valid DOCX buffer for deterministic unit tests.
 */
async function createTestDocx(paragraphs) {
  const doc = new Document({
    sections: [
      {
        children: paragraphs.map(
          (text) => new Paragraph({ text, spacing: { after: 200 } })
        ),
      },
    ],
  });
  return await Packer.toBuffer(doc);
}

function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

async function runPhase8TestSuite() {
  console.log("================================================================================");
  console.log("FILEMENTOR AI — PHASE 8 AUTOMATED TEST SUITE: TRACKED-CHANGE REDLINING");
  console.log("================================================================================");
  console.log(`Base URL: ${BASE_URL}\n`);

  // ---------------------------------------------------------------------------
  // TEST 1: Valid Original DOCX + Updated DOCX
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Valid Original DOCX + Updated DOCX Generation ---");
  let test1RedlineBase64 = null;
  try {
    const origBuf = await createTestDocx([
      "1. Term. The initial term of this Agreement shall be twelve (12) months.",
      "2. Fees. The Client shall pay the Service Provider a fee of $10,000 per month.",
    ]);
    const updBuf = await createTestDocx([
      "1. Term. The initial term of this Agreement shall be twenty-four (24) months.",
      "2. Fees. The Client shall pay the Service Provider a fee of $12,500 per month.",
    ]);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([origBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Agreement_V1.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([updBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Agreement_V2.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    assert(res.status === 200, `API returned status 200 (got ${res.status})`);
    assert(data.success === true, "Response reports success: true");
    assert(!!data.data?.base64, "Redline DOCX base64 content received");
    assert(data.data?.filename?.endsWith(".docx"), `Output filename ends with .docx: ${data.data?.filename}`);
    assert(data.data?.summary?.totalChanges > 0, `Total changes detected: ${data.data?.summary?.totalChanges}`);
    test1RedlineBase64 = data.data?.base64;
  } catch (err) {
    assert(false, `Test 1 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Addition Representation
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Addition Representation ---");
  try {
    const origBuf = await createTestDocx([
      "Section 1. Scope of Services. Provider agrees to deliver software engineering services.",
    ]);
    const updBuf = await createTestDocx([
      "Section 1. Scope of Services. Provider agrees to deliver software engineering services.",
      "Section 2. Service Level Agreement. Provider guarantees 99.9% monthly system uptime and 24/7 technical support.",
    ]);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([origBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Original.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([updBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Updated_With_Addition.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    const data = await res.json();

    assert(res.status === 200, "API returned HTTP 200 for addition test");
    assert(data.data?.summary?.additionsCount >= 1, `Additions count >= 1 (got ${data.data?.summary?.additionsCount})`);
    const hasAddedSection = data.data?.summary?.keySubstantiveChanges?.some((c) =>
      c.toLowerCase().includes("added section") || c.toLowerCase().includes("service level")
    );
    assert(hasAddedSection, "Summary highlights the added section in key substantive changes");
  } catch (err) {
    assert(false, `Test 2 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Deletion Representation
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Deletion Representation ---");
  try {
    const origBuf = await createTestDocx([
      "Section 1. Scope of Services. Provider agrees to deliver software engineering services.",
      "Section 2. Restrictive Covenant. Employee agrees not to compete for a period of five (5) years.",
    ]);
    const updBuf = await createTestDocx([
      "Section 1. Scope of Services. Provider agrees to deliver software engineering services.",
    ]);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([origBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Original_With_Covenant.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([updBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Updated_Deleted_Covenant.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    const data = await res.json();

    assert(res.status === 200, "API returned HTTP 200 for deletion test");
    assert(data.data?.summary?.deletionsCount >= 1, `Deletions count >= 1 (got ${data.data?.summary?.deletionsCount})`);
    const hasDeletedSection = data.data?.summary?.keySubstantiveChanges?.some((c) =>
      c.toLowerCase().includes("removed section") || c.toLowerCase().includes("restrictive covenant")
    );
    assert(hasDeletedSection, "Summary highlights removed section in key substantive changes");
  } catch (err) {
    assert(false, `Test 3 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Modification Representation
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Modification Representation ---");
  try {
    const origBuf = await createTestDocx([
      "The termination notice period is 30 days. The maximum liability cap is $1,000,000.",
    ]);
    const updBuf = await createTestDocx([
      "The termination notice period is 60 days. The maximum liability cap is $5,000,000.",
    ]);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([origBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Orig_Terms.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([updBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Upd_Terms.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    const data = await res.json();

    assert(res.status === 200, "API returned HTTP 200 for modification test");
    assert(data.data?.summary?.modifiedSectionsCount >= 1, "Modified sections count >= 1");
    assert(data.data?.summary?.additionsCount >= 2, `Additions count >= 2 for "60" and "$5,000,000" (got ${data.data?.summary?.additionsCount})`);
    assert(data.data?.summary?.deletionsCount >= 2, `Deletions count >= 2 for "30" and "$1,000,000" (got ${data.data?.summary?.deletionsCount})`);
  } catch (err) {
    assert(false, `Test 4 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Formatting-Only Change (Whitespace / Line Breaks)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Formatting-Only Change ---");
  try {
    const origBuf = await createTestDocx([
      "The parties agree to arbitrate disputes under AAA rules in New York City.",
      "Governing law shall be the laws of the State of Delaware.",
    ]);
    const updBuf = await createTestDocx([
      "The   parties  agree   to arbitrate  disputes  under  AAA rules in  New York City.   ",
      "Governing   law shall be   the laws of the State of Delaware. ",
    ]);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([origBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Doc_Standard.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([updBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Doc_Whitespace.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    const data = await res.json();

    assert(res.status === 200, "API returned HTTP 200 for formatting-only comparison");
    assert(
      data.data?.summary?.unchangedSectionsCount === 2,
      `Unchanged sections count is 2 (got ${data.data?.summary?.unchangedSectionsCount})`
    );
    assert(
      data.data?.summary?.totalChanges === 0,
      `Total changes is 0 (whitespace differences recognized as non-substantive, got ${data.data?.summary?.totalChanges})`
    );
  } catch (err) {
    assert(false, `Test 5 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Invalid PDF Input Rejected Safely
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Invalid PDF Input Rejection ---");
  try {
    const dummyPdfBuffer = Buffer.from("%PDF-1.4\n%EOF\nDummy PDF content");
    const validDocx = await createTestDocx(["Valid contract clause"]);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([dummyPdfBuffer], { type: "application/pdf" }),
      "invalid_contract.pdf"
    );
    formData.append(
      "updatedFile",
      new Blob([validDocx], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "valid_contract.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    const data = await res.json();

    assert(res.status === 400, `Rejected non-DOCX input with HTTP 400 (got ${res.status})`);
    assert(data.success === false, "Response confirms success: false");
    assert(
      data.error?.toLowerCase().includes("docx") || data.error?.toLowerCase().includes("not supported"),
      `Clean error message returned: "${data.error}"`
    );
  } catch (err) {
    assert(false, `Test 6 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Empty Document Handled Safely
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Empty Document Handling ---");
  try {
    const emptyBuffer = Buffer.from([]);
    const validDocx = await createTestDocx(["Valid clause"]);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([emptyBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "empty.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([validDocx], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "valid.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    const data = await res.json();

    assert(res.status === 400, `Empty input rejected safely with HTTP 400 (got ${res.status})`);
    assert(data.success === false, "Response confirms success: false");
    assert(
      data.error?.toLowerCase().includes("empty") || data.error?.toLowerCase().includes("could not be read"),
      `Clean empty document error returned: "${data.error}"`
    );
  } catch (err) {
    assert(false, `Test 7 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Large DOCX Processing
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Large DOCX (150-Page Document) Redline Processing ---");
  try {
    const largeDocPath = path.resolve("uploads/test-docs/Enterprise_Master_150Page.docx");
    const msaDocPath = path.resolve("uploads/test-docs/Master_Services_Agreement.docx");

    assert(fs.existsSync(largeDocPath), "150-page enterprise DOCX exists");

    const largeBuffer = fs.readFileSync(largeDocPath);
    const msaBuffer = fs.readFileSync(msaDocPath);

    const startTime = Date.now();
    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([msaBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "MSA_Original.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([largeBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Enterprise_150Page_Updated.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    const durationMs = Date.now() - startTime;
    const data = await res.json();

    assert(res.status === 200, `Large document redline succeeded with HTTP 200 (in ${durationMs}ms)`);
    assert(data.success === true, "Response succeeded without memory exhaustion or crash");
    assert(!!data.data?.base64, "Generated redline base64 received for large contract");
    assert(data.data?.summary?.totalChanges > 0, `Total changes processed: ${data.data?.summary?.totalChanges}`);
  } catch (err) {
    assert(false, `Test 8 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 9 & 10: Original and Updated File Integrity
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9 & 10: Original and Updated File Integrity ---");
  try {
    const msaPath = path.resolve("uploads/test-docs/Master_Services_Agreement.docx");
    const consultPath = path.resolve("uploads/test-docs/Consulting_Agreement.docx");

    const msaHashBefore = getFileHash(msaPath);
    const consultHashBefore = getFileHash(consultPath);

    const msaBuf = fs.readFileSync(msaPath);
    const consultBuf = fs.readFileSync(consultPath);

    const formData = new FormData();
    formData.append(
      "originalFile",
      new Blob([msaBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Master_Services_Agreement.docx"
    );
    formData.append(
      "updatedFile",
      new Blob([consultBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      "Consulting_Agreement.docx"
    );

    const res = await fetch(`${BASE_URL}/api/redline`, { method: "POST", body: formData });
    assert(res.status === 200, "Redline API succeeded on on-disk files");

    const msaHashAfter = getFileHash(msaPath);
    const consultHashAfter = getFileHash(consultPath);

    assert(msaHashBefore === msaHashAfter, "TEST 9: Original file on disk remains strictly untouched (SHA-256 identical)");
    assert(consultHashBefore === consultHashAfter, "TEST 10: Updated file on disk remains strictly untouched (SHA-256 identical)");
  } catch (err) {
    assert(false, `Test 9/10 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 11: Output DOCX Validity
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: Output DOCX Validity Verification ---");
  try {
    assert(!!test1RedlineBase64, "Redline buffer from Test 1 available");
    const buffer = Buffer.from(test1RedlineBase64, "base64");

    // Attempt parsing with Mammoth
    const extractResult = await mammoth.extractRawText({ buffer });
    const extractedText = extractResult.value || "";

    assert(extractedText.length > 50, `Mammoth successfully extracted text (${extractedText.length} chars)`);
    assert(
      extractedText.includes("REDLINED CONTRACT COMPARISON"),
      "Extracted text contains header 'REDLINED CONTRACT COMPARISON'"
    );
    assert(
      extractedText.includes("REVISION MARKUP LEGEND"),
      "Extracted text contains revision markup legend"
    );
    assert(
      extractedText.includes("twelve") && extractedText.includes("twenty-four"),
      "Extracted text contains comparative contract provisions"
    );
  } catch (err) {
    assert(false, `Test 11 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 12: Security (Path Traversal & Injection Prevention)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 12: Security & Path Traversal Prevention ---");
  try {
    const maliciousDocIds = [
      "../../../../etc/passwd",
      "..\\..\\..\\windows\\win.ini",
      "66f1234567890abcdef12345/../../../etc/shadow",
      "<script>alert('xss')</script>",
      "'; DROP TABLE documents; --",
    ];

    let allBlocked = true;

    for (const badId of maliciousDocIds) {
      const res = await fetch(`${BASE_URL}/api/redline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalDocId: badId,
          updatedDocId: "66f1234567890abcdef12345",
        }),
      });

      if (res.status !== 400 && res.status !== 404) {
        allBlocked = false;
        console.error(`  [WARN] Path traversal input '${badId}' returned status ${res.status}`);
      }
    }

    assert(allBlocked, "All path traversal and injection payloads safely blocked with HTTP 400/404");
  } catch (err) {
    assert(false, `Test 12 failed with exception: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`PHASE 8 REDLINE TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase8TestSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
