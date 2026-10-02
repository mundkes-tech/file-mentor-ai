export interface CandidateQuote {
  text: string;
  documentId?: string;
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatResult {
  answerText: string;
  candidateQuotes: CandidateQuote[];
}

export interface PromptContextOptions {
  isPartialRetrieval?: boolean;
  totalChunksInDocument?: number;
  retrievedChunksCount?: number;
  retrievalConfidence?: "high" | "medium" | "low" | "none";
}

export const aiService = {
  getApiKey(): string {
    return process.env.AI_API_KEY || "";
  },

  getBaseUrl(): string {
    return process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";
  },

  getModel(): string {
    return process.env.AI_MODEL || "qwen/qwen3.8-27b";
  },

  isConfigured(): boolean {
    return !!this.getApiKey();
  },

  /**
   * Generates the system prompt establishing the uploaded contract as the sole source of truth.
   * Includes strict absence safety instructions when only a partial subset of a large document was retrieved.
   */
  buildSystemPrompt(
    documentName: string,
    contextText: string,
    options?: PromptContextOptions
  ): string {
    const isPartial = options?.isPartialRetrieval ?? false;
    const totalCount = options?.totalChunksInDocument ?? 1;
    const retrievedCount = options?.retrievedChunksCount ?? 1;

    const notFoundInstruction = isPartial
      ? `5. "NOT FOUND" / ABSENCE SAFETY MANDATE (CRITICAL):
   Because this is a large document and only a retrieved subset was examined (${retrievedCount} of ${totalCount} sections), you do NOT have complete document visibility.
   - You MUST NOT claim or imply that the contract does not contain a clause, provision, or term (e.g., do NOT say "The contract does not contain...", "There is no clause...", or "The contract makes no mention of...").
   - If the requested information is absent or insufficient in the retrieved sections, you MUST explicitly state:
     "I could not find sufficient relevant information in the retrieved sections of this document."`
      : `5. If the question cannot be answered from the supplied contract context, you MUST explicitly state:
   "The contract does not provide enough information to answer this question."`;

    const coverageHeader = isPartial
      ? `RETRIEVAL COVERAGE: PARTIAL (${retrievedCount} of ${totalCount} sections retrieved)`
      : `RETRIEVAL COVERAGE: COMPLETE (Full document provided)`;

    return `You are LexiGuard AI, a professional legal contract analysis assistant.
You are analyzing the uploaded contract: "${documentName}".
${coverageHeader}

CRITICAL INSTRUCTIONS (MUST FOLLOW STRICTLY):
1. The supplied contract context below is your SOLE SOURCE OF TRUTH.
2. Answer the user's question using ONLY the facts and provisions directly stated in the contract context.
3. Do NOT use outside knowledge, external laws, industry assumptions, or speculation.
4. Do NOT assume or invent missing terms or clauses.
${notFoundInstruction}
6. Do NOT fabricate quotations, page numbers, or offsets. Any quote you provide must be an exact verbatim excerpt from the contract context.
7. Provide a clear, professional, well-structured answer in markdown.
8. At the very end of your response, after your explanation, provide any candidate verbatim quotes supporting your answer inside this exact format:
\`\`\`quotes
[
  { "text": "verbatim text excerpt here" }
]
\`\`\`

--- BEGIN CONTRACT CONTEXT: ${documentName} ---
${contextText}
--- END CONTRACT CONTEXT ---`;
  },

  /**
   * Generates a multi-document system prompt ensuring strict document attribution,
   * prevention of fact mixing, and absence safety across independent contracts.
   */
  buildMultiDocumentSystemPrompt(
    documents: {
      documentId: string;
      documentName: string;
      isPartialRetrieval: boolean;
      totalChunksInDocument: number;
      retrievedChunksCount: number;
    }[],
    contextText: string
  ): string {
    const docSummaries = documents
      .map(
        (d, idx) =>
          `${idx + 1}. "${d.documentName}" (ID: ${d.documentId}) — [Coverage: ${
            d.isPartialRetrieval
              ? `PARTIAL (${d.retrievedChunksCount} of ${d.totalChunksInDocument} sections)`
              : "COMPLETE (Full document provided)"
          }]`
      )
      .join("\n");

    const partialDocs = documents.filter((d) => d.isPartialRetrieval);
    const notFoundSafetyInstruction =
      partialDocs.length > 0
        ? `5. "NOT FOUND" / PARTIAL RETRIEVAL ABSENCE MANDATE (CRITICAL):
   The following documents have PARTIAL retrieval visibility: ${partialDocs
     .map((d) => `"${d.documentName}"`)
     .join(", ")}.
   - You MUST NOT claim or imply that a partially retrieved document lacks a clause, term, or provision (e.g., do NOT say "${partialDocs[0]?.documentName} does not contain...", "There is no termination clause in...", or "The contract makes no mention of...").
   - If the requested information is absent or insufficient in the retrieved sections of any document, you MUST explicitly state:
     "I could not find sufficient relevant information in the retrieved sections of [Document Name]."`
        : `5. If requested information is absent from any document, state clearly that the document does not contain sufficient information to answer that question.`;

    return `You are LexiGuard AI, a professional legal contract analysis assistant.
You are analyzing ${documents.length} independent legal contracts simultaneously:
${docSummaries}

CRITICAL MULTI-DOCUMENT INSTRUCTIONS (MUST FOLLOW STRICTLY):
1. The supplied contract contexts below are your SOLE SOURCE OF TRUTH.
2. The selected contracts are completely INDEPENDENT legal agreements. You MUST preserve document identity at all times.
3. ALWAYS attribute every fact, clause, obligation, or deadline explicitly to the document from which it originates (e.g., "In [Document A], the notice period is... whereas in [Document B]...").
4. NEVER merge, confuse, or combine provisions from different documents as if they belong to the same agreement.
${notFoundSafetyInstruction}
6. Do NOT use outside legal knowledge, industry assumptions, or speculation.
7. Do NOT fabricate quotations. Any quote must be an exact verbatim excerpt from the corresponding contract's text.
8. Provide a clear, organized comparative or multi-document response in markdown.
9. At the very end of your response, after your explanation, provide candidate verbatim quotes supporting your answer inside this exact format:
\`\`\`quotes
[
  { "documentId": "document_id_here", "text": "verbatim text excerpt here" }
]
\`\`\`

--- BEGIN MULTI-CONTRACT CONTEXTS ---
${contextText}
--- END MULTI-CONTRACT CONTEXTS ---`;
  },

  /**
   * Streams chat completions from OpenAI-compatible provider using native fetch.
   * Handles AbortSignal for user cancellation ("Stop Generating").
   */
  async streamChat(
    messages: AiChatMessage[],
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<StreamChatResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        "AI provider API key is not configured. Please set AI_API_KEY in .env.local."
      );
    }

    const baseUrl = this.getBaseUrl().replace(/\/$/, "");
    const model = this.getModel();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      let parsedMessage = errText;
      try {
        const json = JSON.parse(errText);
        parsedMessage = json.error?.message || errText;
      } catch {
        // use raw errText
      }
      throw new Error(`AI Provider Error (${response.status}): ${parsedMessage}`);
    }

    if (!response.body) {
      throw new Error("No response stream body returned by AI provider.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let accumulatedRaw = "";
    let inQuotesBlock = false;
    let quotesRawBuffer = "";
    let answerText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const dataPayload = trimmed.slice(5).trim();
          if (dataPayload === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataPayload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulatedRaw += delta;

              // Check if we reached the ```quotes delimiter
              if (!inQuotesBlock && accumulatedRaw.includes("```quotes")) {
                inQuotesBlock = true;
                const parts = accumulatedRaw.split("```quotes");
                // Emit any tokens that were before ```quotes and not yet emitted
                const preQuoteText = parts[0];
                const unEmitted = preQuoteText.slice(answerText.length);
                if (unEmitted) {
                  onToken(unEmitted);
                  answerText += unEmitted;
                }
                quotesRawBuffer = parts[1] || "";
              } else if (inQuotesBlock) {
                quotesRawBuffer += delta;
              } else {
                // Normal streaming token for user reading
                answerText += delta;
                onToken(delta);
              }
            }
          } catch {
            // Partial JSON chunk line
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError" || signal?.aborted) {
        // Preserves content received so far
        return {
          answerText: answerText.trim(),
          candidateQuotes: this.extractQuotesFromText(accumulatedRaw),
        };
      }
      throw err;
    }

    // Parse candidate quotes from quotesRawBuffer or fallback to extracting quotes from accumulated text
    const candidateQuotes = this.parseCandidateQuotes(quotesRawBuffer, accumulatedRaw);

    return {
      answerText: answerText.trim() || accumulatedRaw.trim(),
      candidateQuotes,
    };
  },

  /**
   * Parses candidate quotes from the ```quotes JSON block or fallback regex.
   */
  parseCandidateQuotes(quotesBuffer: string, fullText: string): CandidateQuote[] {
    const quotes: CandidateQuote[] = [];

    // Try parsing the ```quotes block
    if (quotesBuffer) {
      try {
        const cleaned = quotesBuffer.replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "string" && item.trim()) {
              quotes.push({ text: item.trim() });
            } else if (item && typeof item.text === "string" && item.text.trim()) {
              quotes.push({
                text: item.text.trim(),
                documentId:
                  typeof item.documentId === "string" && item.documentId.trim()
                    ? item.documentId.trim()
                    : undefined,
              });
            }
          }
        }
      } catch {
        // Fallback to regex extraction
      }
    }

    // Fallback: extract markdown quotes > "..." from text
    if (quotes.length === 0) {
      const regexQuotes = this.extractQuotesFromText(fullText);
      quotes.push(...regexQuotes);
    }

    return quotes.slice(0, 5); // Limit to top 5 relevant quotes
  },

  extractQuotesFromText(text: string): CandidateQuote[] {
    const quotes: CandidateQuote[] = [];
    const quoteRegex = />\s*["“](.+?)["”]/g;
    let match;
    while ((match = quoteRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 10) {
        quotes.push({ text: match[1].trim() });
      }
    }
    return quotes;
  },
};
