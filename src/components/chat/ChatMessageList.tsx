"use client";

import React, { useEffect, useRef } from "react";
import { ChatMessage, VerifiedQuote } from "@/types";
import { ChatMessageItem } from "./ChatMessageItem";

interface ChatMessageListProps {
  messages: ChatMessage[];
  onSelectCitation?: (citation: any) => void;
}

export function ChatMessageList({
  messages,
  onSelectCitation,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          onSelectCitation={onSelectCitation}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
