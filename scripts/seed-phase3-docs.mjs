import mongoose from "mongoose";

try {
  process.loadEnvFile?.(".env.local");
} catch {}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI. Please set MONGODB_URI in .env.local or your environment.");
}

const DocumentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    originalFilename: { type: String, required: true },
    name: { type: String, required: true },
    fileType: { type: String, enum: ["pdf", "docx"], required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    storagePath: { type: String, required: true },
    processingStatus: { type: String, default: "ready" },
    extractedText: { type: String, default: "" },
    textLength: { type: Number, default: 0 },
    pageCount: { type: Number, default: 1 },
    pages: { type: Array, default: [] },
    paragraphs: { type: [String], default: [] },
  },
  { timestamps: true, _id: false }
);

const DocumentModel =
  mongoose.models.Document || mongoose.model("Document", DocumentSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const pdfText = `MUTUAL CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT
This Non-Disclosure Agreement is entered into between Acme Labs and Beta Corp.
1. Confidential Information: Both parties agree to protect proprietary source code.
2. Governing Law: This agreement shall be governed by Delaware jurisdiction.`;

  const docxText = `SOFTWARE LICENSE AGREEMENT
This Software License Agreement is made between CloudScale Systems and Enterprise Client.
1. Grant of License: Licensor grants Licensee a non-exclusive subscription license.
2. Limitation of Liability: Total damages shall not exceed fees paid in the prior 12 months.`;

  await DocumentModel.findOneAndUpdate(
    { _id: "doc_1790847139404_tsyn0j" },
    {
      _id: "doc_1790847139404_tsyn0j",
      name: "NDA_Acme_Beta",
      originalFilename: "NDA_Acme_Beta.pdf",
      fileType: "pdf",
      mimeType: "application/pdf",
      fileSize: 450,
      storagePath: "",
      processingStatus: "ready",
      extractedText: pdfText,
      textLength: pdfText.length,
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: pdfText,
          textLength: pdfText.length,
          startOffset: 0,
          endOffset: pdfText.length,
        },
      ],
      paragraphs: pdfText.split("\n"),
    },
    { upsert: true, new: true }
  );

  await DocumentModel.findOneAndUpdate(
    { _id: "doc_1790847139573_bagfe7" },
    {
      _id: "doc_1790847139573_bagfe7",
      name: "CloudScale_License",
      originalFilename: "CloudScale_License.docx",
      fileType: "docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: 1200,
      storagePath: "",
      processingStatus: "ready",
      extractedText: docxText,
      textLength: docxText.length,
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: docxText,
          textLength: docxText.length,
          startOffset: 0,
          endOffset: docxText.length,
        },
      ],
      paragraphs: docxText.split("\n"),
    },
    { upsert: true, new: true }
  );

  console.log("Seeded Phase 3/4 baseline test documents successfully");
  await mongoose.disconnect();
}

seed().catch(console.error);
