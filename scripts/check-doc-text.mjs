async function run() {
  const pdfRes = await fetch("http://localhost:3000/api/documents/doc_1790847139404_tsyn0j");
  const pdfData = await pdfRes.json();
  console.log("=== PDF Document text ===\n", pdfData.data.fullText);

  const docxRes = await fetch("http://localhost:3000/api/documents/doc_1790847139573_bagfe7");
  const docxData = await docxRes.json();
  console.log("=== DOCX Document text ===\n", docxData.data.fullText);
}

run().catch(console.error);
