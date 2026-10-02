"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChatMessage, CandidateQuote } from "@/types";

export function useChat(documentId: string | null, documentIds?: string[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Derive active document IDs and stable session key
  const effectiveIds = useMemo(() => {
    if (documentIds && documentIds.length > 1) {
      return Array.from(new Set(documentIds.map((id) => id.trim()))).filter(Boolean).sort();
    }
    return documentId ? [documentId.trim()] : [];
  }, [documentId, documentIds]);

  const sessionKey = useMemo(() => {
    return effectiveIds.join("+");
  }, [effectiveIds]);

  // Load chat history when active session changes
  useEffect(() => {
    if (!sessionKey || effectiveIds.length === 0) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      setError(null);
      try {
        const queryParam =
          effectiveIds.length > 1
            ? `documentIds=${encodeURIComponent(effectiveIds.join(","))}`
            : `documentId=${encodeURIComponent(effectiveIds[0])}`;

        const res = await fetch(`/api/chat?${queryParam}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.data) {
            setMessages(json.data);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load chat history");
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
      // Abort any ongoing stream if session switches
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sessionKey, effectiveIds]);

  // Send message and stream answer
  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const textToSend = (overrideText || inputMessage).trim();
      if (!textToSend || effectiveIds.length === 0 || isStreaming) return;

      const primaryDocId = effectiveIds[0];
      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;

      const userMsg: ChatMessage = {
        id: userMsgId,
        documentId: primaryDocId,
        documentIds: effectiveIds.length > 1 ? effectiveIds : undefined,
        role: "user",
        content: textToSend,
        timestamp: new Date().toISOString(),
        status: "complete",
      };

      const initialAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        documentId: primaryDocId,
        documentIds: effectiveIds.length > 1 ? effectiveIds : undefined,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        status: "streaming",
        candidateQuotes: [],
      };

      // Update local state immediately
      setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
      setInputMessage("");
      setIsStreaming(true);
      setError(null);

      // Create AbortController for stream cancellation
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const payload: Record<string, any> = {
          documentId: primaryDocId,
          message: textToSend,
        };
        if (effectiveIds.length > 1) {
          payload.documentIds = effectiveIds;
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Chat error (${response.status})`);
        }

        if (!response.body) {
          throw new Error("No response body received from server");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";
        let finalCandidateQuotes: CandidateQuote[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "token" && data.content) {
                  accumulatedText += data.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: accumulatedText, status: "streaming" }
                        : msg
                    )
                  );
                } else if (data.type === "retrieval_meta") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? {
                            ...msg,
                            retrievalMetadata: {
                              sectionsRetrieved: data.sectionsRetrieved,
                              totalSections: data.totalSections,
                              isPartial: data.isPartial,
                              strategy: "lexical",
                            },
                          }
                        : msg
                    )
                  );
                } else if (data.type === "verified_quotes") {
                  const verifiedQuotes = data.verifiedQuotes || [];
                  const candidateQuotes = data.candidateQuotes || [];
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, citations: verifiedQuotes, candidateQuotes }
                        : msg
                    )
                  );
                } else if (
                  (data.type === "candidate_quotes" && data.candidateQuotes) ||
                  (data.type === "citation" && data.citations)
                ) {
                  finalCandidateQuotes = data.candidateQuotes || data.citations;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, candidateQuotes: finalCandidateQuotes }
                        : msg
                    )
                  );
                } else if (data.type === "stopped") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, status: "stopped", content: data.content || accumulatedText }
                        : msg
                    )
                  );
                } else if (data.type === "done") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId ? { ...msg, status: "complete" } : msg
                    )
                  );
                } else if (data.type === "error") {
                  setError(data.error);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, status: "error", error: data.error }
                        : msg
                    )
                  );
                }
              } catch {
                // Ignore parse errors on partial chunk lines
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Stream was manually stopped by user: preserve generated content!
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, status: "stopped" } : msg
            )
          );
        } else {
          setError(err.message || "Failed to generate AI response");
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    status: "error",
                    error: err.message || "Response generation failed",
                  }
                : msg
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [effectiveIds, inputMessage, isStreaming]
  );

  // Stop generating response while strictly preserving partial output
  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  // Clear chat history
  const clearChat = useCallback(async () => {
    if (effectiveIds.length === 0) return;
    try {
      const queryParam =
        effectiveIds.length > 1
          ? `documentIds=${encodeURIComponent(effectiveIds.join(","))}`
          : `documentId=${encodeURIComponent(effectiveIds[0])}`;

      await fetch(`/api/chat?${queryParam}`, {
        method: "DELETE",
      });
      setMessages([]);
    } catch (err: any) {
      setError(err.message || "Failed to clear chat");
    }
  }, [effectiveIds]);

  return {
    messages,
    inputMessage,
    setInputMessage,
    isStreaming,
    isLoadingHistory,
    error,
    sendMessage,
    stopGenerating,
    clearChat,
  };
}
