"use client";

import React, { useRef, useEffect } from "react";
import { Send, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (val: string) => void;
  onSendMessage: () => void;
  onStopGenerating: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  inputMessage,
  setInputMessage,
  onSendMessage,
  onStopGenerating,
  isStreaming,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [inputMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && inputMessage.trim()) {
        onSendMessage();
      }
    }
  };

  return (
    <div className="flex flex-col border-t border-[#E4E1DA] bg-white p-3 space-y-2">
      <div className="relative flex items-end gap-2 rounded-lg border border-[#E4E1DA] bg-[#F7F7F5] p-2 focus-within:border-[#B7791F] focus-within:ring-1 focus-within:ring-[#B7791F]/30 transition-all">
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about this contract..."
          rows={1}
          disabled={disabled}
          className="flex-1 max-h-36 resize-none bg-transparent px-2 py-1 text-xs text-[#171717] placeholder:text-[#6B6B67] focus:outline-none"
        />

        {/* Dynamic Action Button: Send or Stop */}
        {isStreaming ? (
          <Button
            type="button"
            onClick={onStopGenerating}
            variant="danger"
            size="sm"
            className="h-8 px-2.5 text-xs shrink-0"
            title="Stop generation"
            leftIcon={<Square className="h-3 w-3 fill-white" />}
          >
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSendMessage}
            disabled={!inputMessage.trim() || disabled}
            variant="primary"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            title="Send query"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between px-1 text-[10px] text-[#6B6B67]">
        <span className="flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5 text-[#B7791F]" />
          Quotes verified against ground-truth contract text
        </span>
        <span className="hidden sm:inline">Press Enter to send</span>
      </div>
    </div>
  );
}
