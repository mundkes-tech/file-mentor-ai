import fs from "fs";
import path from "path";

// 1. Generate minimal valid PDF with readable legal text
function createValidPdfBuffer() {
  const content = `BT
/F1 14 Tf
72 712 Td
(MUTUAL CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT) Tj
0 -24 Td
/F1 10 Tf
(This Non-Disclosure Agreement is entered into between Acme Labs and Beta Corp.) Tj
0 -16 Td
(1. Confidential Information: Both parties agree to protect proprietary source code.) Tj
0 -16 Td
(2. Governing Law: This agreement shall be governed by Delaware jurisdiction.) Tj
ET`;

  const streamLength = Buffer.byteLength(content);

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000300 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
380
%%EOF`;

  return Buffer.from(pdf);
}

// 2. Generate scanned/image-only PDF (no text streams)
function createScannedPdfBuffer() {
  const content = ``;
  const streamLength = 0;

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
270
%%EOF`;

  return Buffer.from(pdf);
}

// 3. Generate valid DOCX buffer using JSZip
async function createValidDocxBuffer() {
  // We installed jszip as a dependency of mammoth
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>SOFTWARE LICENSE AGREEMENT</w:t></w:r></w:p>
    <w:p><w:r><w:t>This Software License Agreement is made between CloudScale Systems and Enterprise Client.</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Grant of License: Licensor grants Licensee a non-exclusive subscription license.</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Limitation of Liability: Total damages shall not exceed fees paid in the prior 12 months.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );

  return await zip.generateAsync({ type: "nodebuffer" });
}

async function runTests() {
  const BASE_URL = "http://localhost:3000";
  console.log("=== PHASE 2 TEST SUITE STARTING ===\n");

  const results = [];

  // Helper to post file
  async function postFile(filename, buffer, mimeType) {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("file", blob, filename);

    const res = await fetch(`${BASE_URL}/api/documents`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, json };
  }

  // TEST 1: Valid PDF
  console.log("[Test 1] Uploading Valid PDF...");
  const validPdfBuf = createValidPdfBuffer();
  const pdfRes = await postFile("NDA_Acme_Beta.pdf", validPdfBuf, "application/pdf");
  console.log("Status:", pdfRes.status, "Success:", pdfRes.ok);
  if (pdfRes.ok && pdfRes.json.data?.status === "ready") {
    console.log("✓ Valid PDF successfully extracted and marked ready!");
    console.log("  Doc ID:", pdfRes.json.data.id);
    console.log("  Page count:", pdfRes.json.data.pageCount);
    results.push({ name: "1. Valid PDF Upload & Text Extraction", passed: true });
  } else {
    console.error("✗ Valid PDF test failed:", pdfRes.json);
    results.push({ name: "1. Valid PDF Upload & Text Extraction", passed: false });
  }
  const uploadedPdfId = pdfRes.json.data?.id;

  // TEST 2: Valid DOCX
  console.log("\n[Test 2] Uploading Valid DOCX...");
  const validDocxBuf = await createValidDocxBuffer();
  const docxRes = await postFile(
    "CloudScale_License.docx",
    validDocxBuf,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  console.log("Status:", docxRes.status, "Success:", docxRes.ok);
  if (docxRes.ok && docxRes.json.data?.status === "ready") {
    console.log("✓ Valid DOCX successfully extracted and marked ready!");
    console.log("  Doc ID:", docxRes.json.data.id);
    console.log("  Page count:", docxRes.json.data.pageCount);
    results.push({ name: "2. Valid DOCX Upload & Paragraph Extraction", passed: true });
  } else {
    console.error("✗ Valid DOCX test failed:", docxRes.json);
    results.push({ name: "2. Valid DOCX Upload & Paragraph Extraction", passed: false });
  }
  const uploadedDocxId = docxRes.json.data?.id;

  // TEST 3: Invalid File Type (.txt)
  console.log("\n[Test 3] Uploading Invalid File Type (.txt)...");
  const txtBuf = Buffer.from("Some plain text file that should be rejected");
  const txtRes = await postFile("contract.txt", txtBuf, "text/plain");
  console.log("Status:", txtRes.status, "Error:", txtRes.json.error);
  if (txtRes.status === 400 && txtRes.json.error?.includes("Unsupported file type")) {
    console.log("✓ Invalid file type successfully rejected with clear user-friendly error!");
    results.push({ name: "3. Invalid File Type Rejection", passed: true });
  } else {
    console.error("✗ Invalid file type test failed:", txtRes);
    results.push({ name: "3. Invalid File Type Rejection", passed: false });
  }

  // TEST 4: Oversized File (>50MB check)
  console.log("\n[Test 4] Validating oversized file handling (>50MB)...");
  const largeBuf = Buffer.alloc(51 * 1024 * 1024);
  const largeRes = await postFile("oversized_contract.pdf", largeBuf, "application/pdf");
  console.log("Status:", largeRes.status, "Error:", largeRes.json.error);
  if (largeRes.status === 400 && largeRes.json.error?.includes("50 MB")) {
    console.log("✓ Oversized file successfully rejected!");
    results.push({ name: "4. Oversized File Validation", passed: true });
  } else {
    console.error("✗ Oversized file test failed:", largeRes);
    results.push({ name: "4. Oversized File Validation", passed: false });
  }

  // TEST 5: Empty Document (0 bytes)
  console.log("\n[Test 5] Uploading Empty Document (0 bytes)...");
  const emptyBuf = Buffer.alloc(0);
  const emptyRes = await postFile("empty.pdf", emptyBuf, "application/pdf");
  console.log("Status:", emptyRes.status, "Error:", emptyRes.json.error);
  if (emptyRes.status === 400 && emptyRes.json.error?.includes("empty")) {
    console.log("✓ Empty document successfully rejected!");
    results.push({ name: "5. Empty Document (0 bytes) Rejection", passed: true });
  } else {
    console.error("✗ Empty document test failed:", emptyRes);
    results.push({ name: "5. Empty Document (0 bytes) Rejection", passed: false });
  }

  // TEST 6: Scanned/Image-Only PDF Detection
  console.log("\n[Test 6] Uploading Scanned / Image-only PDF with 0 extractable text...");
  const scannedPdfBuf = createScannedPdfBuffer();
  const scannedRes = await postFile("scanned_agreement_image_only.pdf", scannedPdfBuf, "application/pdf");
  console.log("Status:", scannedRes.status, "Error:", scannedRes.json.error);
  if (
    scannedRes.status === 422 &&
    scannedRes.json.error?.includes("scanned/image-only") &&
    scannedRes.json.data?.status === "failed"
  ) {
    console.log("✓ Scanned PDF detected accurately!");
    console.log("  Status set to 'failed'");
    console.log("  Error message:", scannedRes.json.error);
    results.push({ name: "6. Scanned/Image-Only PDF Detection & Failure Handling", passed: true });
  } else {
    console.error("✗ Scanned PDF test failed:", scannedRes);
    results.push({ name: "6. Scanned/Image-Only PDF Detection & Failure Handling", passed: false });
  }
  const scannedDocId = scannedRes.json.data?.id;

  // TEST 7: Multiple Documents in Library (GET /api/documents)
  console.log("\n[Test 7] Verifying Document Library Retrieval from MongoDB (GET /api/documents)...");
  const listRes = await fetch(`${BASE_URL}/api/documents`);
  const listJson = await listRes.json();
  console.log("Status:", listRes.status, "Count:", listJson.data?.length);
  if (listRes.ok && Array.isArray(listJson.data) && listJson.data.length >= 2) {
    console.log("✓ MongoDB document library returned active documents successfully!");
    results.push({ name: "7. Multiple Documents Library Retrieval", passed: true });
  } else {
    console.error("✗ Document library list failed:", listJson);
    results.push({ name: "7. Multiple Documents Library Retrieval", passed: false });
  }

  // TEST 8: Open Document (GET /api/documents/:id)
  console.log("\n[Test 8] Opening Document & Inspecting Extracted Content (GET /api/documents/:id)...");
  if (uploadedPdfId) {
    const getRes = await fetch(`${BASE_URL}/api/documents/${uploadedPdfId}`);
    const getJson = await getRes.json();
    console.log("Status:", getRes.status, "Has FullText:", !!getJson.data?.fullText);
    console.log("Pages count:", getJson.data?.pages?.length);
    console.log("Extracted snippet:", getJson.data?.fullText?.substring(0, 100));
    if (getRes.ok && getJson.data?.fullText?.includes("MUTUAL CONFIDENTIALITY")) {
      console.log("✓ Document opened and extracted text verified!");
      results.push({ name: "8. Open Document & Verify Text Payload", passed: true });
    } else {
      console.error("✗ Open document failed:", getJson);
      results.push({ name: "8. Open Document & Verify Text Payload", passed: false });
    }
  }

  // TEST 9: Delete Document (DELETE /api/documents/:id)
  console.log("\n[Test 9] Deleting Document (DELETE /api/documents/:id)...");
  if (scannedDocId) {
    const delRes = await fetch(`${BASE_URL}/api/documents/${scannedDocId}`, {
      method: "DELETE",
    });
    const delJson = await delRes.json();
    console.log("Status:", delRes.status, "Deleted:", delJson.success);
    if (delRes.ok && delJson.success) {
      console.log("✓ Document deleted from MongoDB and file system!");
      results.push({ name: "9. Delete Document & Cleanup", passed: true });
    } else {
      console.error("✗ Delete document failed:", delJson);
      results.push({ name: "9. Delete Document & Cleanup", passed: false });
    }
  }

  console.log("\n=== SUMMARY OF RESULTS ===");
  for (const r of results) {
    console.log(`${r.passed ? "✓ PASS" : "✗ FAIL"}: ${r.name}`);
  }
}

runTests().catch(console.error);
