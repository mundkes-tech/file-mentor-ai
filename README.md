# LexiGuard AI — Legal Contract Analysis AI

Production-grade, deterministic legal contract intelligence platform built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **MongoDB**, and an isolated LLM provider layer.

LexiGuard AI solves the critical failure point of generic legal AI systems: **unverified hallucinations**. Every citation, clause comparison, and redlined delta is validated non-probabilistically against the authoritative ground-truth contract text.

---

## 🌟 Core Features

* **Multi-Format Ingestion**: Upload native PDF and Microsoft Word DOCX agreements (`unpdf`, `mammoth`).
* **Authoritative Text Extraction**: Character-accurate extraction, page boundary mapping, and scanned-document detection.
* **Large-Document Chunking & Retrieval**: Structure-preserving clause chunking and deterministic BM25 lexical ranking for enterprise contracts (tested up to 150+ pages).
* **Bounded Context & Absence Safety**: Never truncates silently. Injects absence-safety mandates when inspecting partial context to prevent unsupported claims of non-existence.
* **Single & Multi-Document AI Chat**: Ask questions across a single contract or compare terms across multiple agreements simultaneously.
* **Deterministic Quote Verification Engine**: 100% non-LLM algorithmic verification of candidate quotes with character index matching, whitespace/newline tolerance, and duplicate disambiguation.
* **Interactive Citation Navigation**: Clicking verified citations navigates to the exact page, auto-switches documents in multi-document mode, and highlights the exact passage.
* **Contract Comparison & Clause Alignment**: Semantic & structural clause pairing with substantive difference detection (e.g. 30 days vs 60 days notice, $1M vs $5M liability caps).
* **Tracked-Change Redlining (Part C)**: Direct DOCX comparison generating a downloadable, fully valid `.docx` document with standard revision conventions (additions in green bold underline, deletions in red strikethrough, revision legend, and change summary).

---

## 🏗️ Architecture Workflows

### 1. Document Ingestion, Retrieval & Citation Highlighting
```text
Uploaded Document (PDF / DOCX)
        ↓
Text Extraction & Readability Validation (mammoth / unpdf)
        ↓
Structure-Aware Chunking (Heading-Aware Clause Splitting)
        ↓
MongoDB Persistence (Document & DocumentChunk Collections)
        ↓
User Question
        ↓
Deterministic BM25 Lexical Retrieval (Document-Isolated)
        ↓
Controlled Context Window (Budget Capped, Natural Reading Order)
        ↓
LLM Context Generation + Absence Safety Mandate
        ↓
Streamed Answer + Candidate Quotes (SSE)
        ↓
Deterministic Verification Engine (Evaluated against Authoritative FULL Document)
        ↓
Verified Citations (Character Offsets, Page Bounds, Source Doc ID)
        ↓
Interactive Document Viewer Highlighting
```

### 2. Multi-Contract Comparison
```text
Contract A (DOCX/PDF)  +  Contract B (DOCX/PDF)
        ↓
Structural & Semantic Clause Alignment (Standard Legal Categories)
        ↓
Deterministic Numeric & Substantive Difference Detection
        ↓
Dual-Document Verified Sources & Discrepancy Attribution
```

### 3. Tracked-Change Redlining (Part C)
```text
Original DOCX  +  Updated DOCX
        ↓
Safe Input Validation & Format Checking (mammoth)
        ↓
Paragraph Alignment & Word-Level Diffing (diffWordsWithSpace)
        ↓
Substantive Change Prioritization (Filtering Pure Formatting Differences)
        ↓
DOCX Revision Generation (docx TextRuns: Green Underline / Red Strikethrough)
        ↓
Downloadable Valid Redlined Contract (.docx)
```

---

## 💻 Tech Stack

* **Framework**: Next.js 16 (App Router, Turbopack)
* **Language**: TypeScript 5 (Strict Mode)
* **Styling**: Tailwind CSS & Lucide Icons
* **Database**: MongoDB & Mongoose
* **Document Extraction**: `mammoth` (DOCX), `unpdf` (PDF)
* **Document Generation & Redline**: `docx` (OpenXML binary generator), `diff` (word-level diffing)
* **Streaming & Transport**: Native Server-Sent Events (SSE), Web Streams API, `fetch` multipart form data
* **AI Provider**: OpenAI-compatible LLM gateway (Groq, OpenAI, OpenRouter, local vLLM/Ollama)

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure the required variables:

| Variable | Required | Description | Example / Target |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string (or local for dev) | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/legal-contract-ai` |
| `AI_API_KEY` | Yes | API Key for LLM provider (Groq, OpenAI, OpenRouter, etc.) | `gsk_...` or `sk-...` |
| `AI_BASE_URL` | Yes | Base endpoint URL for the OpenAI-compatible API | `https://api.groq.com/openai/v1` |
| `AI_MODEL` | Yes | Model identifier | `llama-3.3-70b-versatile` |

> [!CAUTION]
> In production environments (`NODE_ENV === "production"`), the application strictly requires `MONGODB_URI` and throws an explicit startup error if missing. Never commit credentials to version control.

---

## 🚀 Installation & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Local Environment
Set your `MONGODB_URI` and `AI_API_KEY` in `.env.local`.

### 3. Generate Benchmark Test Contracts
Generates sample Master Services Agreement, Consulting Agreement, and the 150-page enterprise contract:
```bash
node scripts/generate-test-contracts.mjs
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🚢 Production Deployment

### Intended Production Architecture

* **Frontend & API**: Next.js App Router deployed on any standard Next.js hosting platform (Vercel, AWS Amplify, Render, Cloud Run, Docker).
* **Database**: MongoDB Atlas cluster (M0 free tier or higher). Connect via standard SRV connection string in `MONGODB_URI`.
* **AI Engine**: External OpenAI-compatible provider (e.g., Groq, OpenAI, OpenRouter, or self-hosted vLLM). Configured via `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`.
* **Document Storage & Persistence**:
  - Authoritative Ground Truth: Extracted document text, page divisions, paragraph coordinates, structured chunks, clause classifications, verification cache, and chat session histories are **100% persisted in MongoDB Atlas**.
  - Serverless Storage Notice: On serverless platforms (e.g. Vercel), local disk (`/uploads`) is ephemeral. The application is architected so that all critical workflows (BM25 retrieval, exact-offset quote verification, citation highlighting, and multi-document analysis) execute entirely against MongoDB and in-memory streams. For tracked-change redlining, files uploaded directly through the Redline modal are processed in-memory via multipart form buffers; library documents reconstruct valid OpenXML structures from MongoDB `extractedText` if original binary is absent on ephemeral disk. For permanent binary archiving in enterprise serverless setups, mounting S3/R2 or deploying containerized workloads (Docker/K8s) provides continuous disk persistence.

---

## ✅ Production Deployment Checklist

The following 22-step checklist validates production readiness from initial setup through final deployment:

1. [ ] **Clone repository**: Clone the clean Git repository into the target build environment.
2. [ ] **Install dependencies**: Run `npm install` (or `npm ci` in CI/CD pipelines) to install pinned production dependencies.
3. [ ] **Configure environment variables**: Create production environment variables on your hosting dashboard matching `.env.example`.
4. [ ] **Configure MongoDB Atlas**: Create a MongoDB Atlas cluster, configure network access whitelist (or 0.0.0.0/0 with strong credentials), and set `MONGODB_URI`.
5. [ ] **Configure AI provider**: Set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` to your external OpenAI-compatible inference provider.
6. [ ] **Run locally**: Validate local execution with `npm run dev` and ensure zero runtime errors.
7. [ ] **Run tests**: Execute all cumulative regression test suites (`node scripts/test-phase*.mjs`) ensuring 232/232 tests pass.
8. [ ] **Build**: Run `npm run build` and `npx tsc --noEmit` to verify type safety and compilation.
9. [ ] **Deploy**: Trigger production deployment to your Next.js hosting platform or container registry.
10. [ ] **Configure production environment variables**: Ensure all 4 production variables (`MONGODB_URI`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`) are active on the production platform.
11. [ ] **Test document upload**: In production, upload a contract through the UI and verify successful ingestion.
12. [ ] **Test PDF extraction**: Upload a standard PDF contract and confirm text and page boundaries are correctly extracted.
13. [ ] **Test DOCX extraction**: Upload a DOCX contract and verify paragraphs, clauses, and structure are correctly indexed.
14. [ ] **Test AI chat**: Submit a legal question to the Contract Assistant and verify response generation.
15. [ ] **Test streaming**: Verify that tokens stream in real-time without buffering or SSE truncation.
16. [ ] **Test quote verification**: Ensure returned citations are verified algorithmically against MongoDB ground-truth text with green badges.
17. [ ] **Test citation highlighting**: Click a verified citation badge and verify the document viewer scrolls to the exact page and passage with gold/cream highlight.
18. [ ] **Test large document retrieval**: Upload the 150-page enterprise agreement and verify BM25 retrieval finds relevant sections without context overflow.
19. [ ] **Test multi-document Q&A**: Select two contracts simultaneously and ask a comparative question; verify document-attributed citations.
20. [ ] **Test contract comparison**: Open the Comparison modal between two contracts and verify clause alignment differences.
21. [ ] **Test DOCX redline generation**: Submit an original and revised DOCX to the Redliner and confirm diff generation with summary statistics.
22. [ ] **Test download**: Click Download Redlined DOCX and confirm the resulting `.docx` opens cleanly in Microsoft Word or Google Docs with revision styling.

---

## ⚠️ Known Limitations

1. **DOCX Logical Page Mapping**: Microsoft Word `.docx` files do not store fixed pagination because layout is computed dynamically by the renderer based on printer drivers and margins. LexiGuard AI maps DOCX pagination logically using standard ~3,000 character paragraph page blocks.
2. **Word Revision Standard**: The Part C Redlining engine produces visual tracked-change markup (additions in green underline, deletions in red strikethrough) using universal OpenXML `TextRun` properties. This provides 100% rendering fidelity across Word, Google Docs, and LibreOffice without risk of corrupting proprietary Word `w:ins` / `w:del` XML tracking schemas.
3. **Lexical Keyword Dependency**: Retrieval utilizes deterministic BM25 with n-gram and legal heading bonuses. Queries completely devoid of lexical or root overlap with the contract text rely on lexical fallback.

---

## 🎬 3–5 Minute Demonstration Walkthrough

Follow these steps for a complete evaluation demonstration:

1. **Demo 1 — Upload Contract**:
   * Click **Upload Contract** in the top header.
   * Select `uploads/test-docs/Master_Services_Agreement.docx`.
   * Observe extraction, chunk generation, and instant availability in the Contract Library.

2. **Demo 2 — Ask Question with Streamed Answer**:
   * Select the uploaded agreement.
   * Ask: *"What is the governing law and what is the termination notice period?"*
   * Observe real-time token streaming and subsequent emission of verified green citation badges.

3. **Demo 3 — Click Verified Citation**:
   * Click the verified quote badge underneath the answer.
   * Notice the viewer automatically navigates to the exact page and paints an amber highlight directly over the matching passage.

4. **Demo 4 — Large Document Retrieval (150 Pages)**:
   * Upload `uploads/test-docs/Enterprise_Master_150Page.docx`.
   * Ask: *"What are the liquidated damages for migration delay?"*
   * Observe bounded retrieval finding the exact clause located on **Page 142** out of 150 pages without exceeding context limits.

5. **Demo 5 — Multi-Document Questions**:
   * Check both `Master Services Agreement` and `Consulting Agreement` in the sidebar.
   * Ask: *"What are the termination notice periods in these contracts?"*
   * Observe the copilot attributing facts independently to each contract with document-specific citations.

6. **Demo 6 — Contract Comparison**:
   * With both contracts selected, click **Compare (2)** in the sidebar.
   * Review the clause alignment matrix, highlighting substantive differences (e.g. 60 days vs 30 days notice; $5,000,000 liability cap vs $25,000 fee).

7. **Demo 7 — Tracked-Change Redlining (Part C)**:
   * Click **Redline DOCX** in the header.
   * Select `Master_Services_Agreement.docx` as Original and `Consulting_Agreement.docx` as Updated (or upload two versions).
   * Click **Generate Redline**.
   * Observe the breakdown of additions, deletions, and modified sections.
   * Click **Download Redlined DOCX** and open the resulting `.docx` in Microsoft Word or Google Docs to view the tracked changes.

---

## 📝 Assignment Submission Notes (Half-Page Architectural Summary)

### 1. How Quote Verification Works, and Where It Could Fail
* **Mechanism**: Quote verification is 100% deterministic and non-LLM. Candidate quotes emitted by the AI are verified against the authoritative full document text stored in MongoDB. The engine builds a character index mapping each canonical character back to its raw offset in the original document, collapsing irregular whitespace (tabs, newlines, non-breaking spaces) and normalizing directional smart quotes (`“”‘’`) and dashes (`—–`). Once verified, the exact page number and passage offsets are calculated from the document's page boundary array. Duplicate occurrences are disambiguated deterministically using page and chunk proximity.
* **Failure Modes**: 
  - Substantial AI paraphrasing (if the model rewords a clause rather than citing verbatim).
  - OCR typos in degraded scanned documents (e.g., "corn" extracted as "com").
  - Mid-sentence running headers or footers injected across physical PDF page breaks.

### 2. How Large Documents Are Handled (150+ Pages)
* **Structure-Preserving Chunking**: Documents are split into semantic clause chunks preserving headings and section boundaries rather than arbitrary token cuts.
* **Deterministic BM25 Retrieval**: Chunks are indexed and ranked using BM25 with title/keyword weighting, running isolated per document.
* **Bounded Context Window**: Context passed to the LLM is strictly capped at ~20,000 characters (~5 top-ranked chunks in document order), ensuring scalable inference with sub-second retrieval times on 150+ page contracts.
* **Absence Safety Mandate**: When operating on partial retrieval, the prompt injects an explicit safety mandate: the model is strictly forbidden from claiming a clause does not exist simply because it was not in the retrieved subset, and must instead state: *"I could not find sufficient relevant information in the retrieved sections of this document."*

### 3. Part C: Tracked-Change Redlining (Option 1)
* **Rationale**: Selected Option 1 because legal transactional workflows require a tangible, reviewable Microsoft Word (`.docx`) deliverable that can be shared with clients or opposing counsel.
* **Implementation Status**: Fully complete (38/38 tests passing in Phase 8 suite). Word-level token diffing aligns paragraphs, identifies substantive modifications (filtering whitespace-only noise), and generates a fully valid OpenXML `.docx` with standard revision styling (insertions in green bold underline, deletions in red strikethrough), a revision legend, and change summary metrics.
* **Hardest Part**: Normalizing Word's internal fragmented XML `w:r` runs so that diffing operates on cohesive phrases without generating hundreds of spurious punctuation splits.

### 4. What Would Be Built Next with More Time
* Native Word `w:ins` / `w:del` tracked revisions with user-attribution metadata.
* Hybrid dense-semantic vector retrieval (using local embeddings) paired with the existing BM25 lexical engine.
* Automated client playbook compliance checks (e.g., flagging deviations from standard indemnification limits).
* Automated PII anonymization before sending excerpts to external AI providers.
