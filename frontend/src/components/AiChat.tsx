"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BoardData } from "@/lib/kanban";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onBoardUpdate: (board: BoardData) => void;
  currentBoard: BoardData;
  username: string;
};

export const AiChat = ({
  isOpen,
  onClose,
  onBoardUpdate,
  currentBoard,
  username,
}: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!input.trim()) return;

    // Add user message to chat history
    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      // Send request to backend AI endpoint
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          prompt: input,
          conversationHistory,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to get AI response");
      }

      const data = await response.json();

      // Add assistant message to chat
      const assistantMessage: ChatMessage = {
        id: `msg-assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If AI suggested board update, apply it
      if (data.boardUpdate) {
        onBoardUpdate(data.boardUpdate);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `msg-error-${Date.now()}`,
        role: "assistant",
        content: `Error: ${errorMsg}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-96 border-l border-[var(--stroke)] bg-white shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
        <h2 className="text-lg font-semibold text-[var(--navy-dark)]">AI Assistant</h2>
        <button
          onClick={onClose}
          className="text-[var(--gray-text)] hover:text-[var(--navy-dark)] transition"
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--gray-text)]">
            Ask me to create, edit, or move cards on your board. I can help organize your tasks!
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-4 py-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-[var(--primary-blue)] text-white"
                    : msg.role === "assistant"
                      ? "bg-[var(--stroke)] text-[var(--navy-dark)]"
                      : "bg-red-50 text-red-700"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--stroke)] text-[var(--navy-dark)] px-4 py-3 rounded-2xl">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={sendMessage}
        className="border-t border-[var(--stroke)] p-4 bg-white"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to move, edit, or create cards..."
            disabled={isLoading}
            className="flex-1 rounded-full border border-[var(--stroke)] px-4 py-2 text-sm outline-none focus:border-[var(--primary-blue)] disabled:bg-[var(--stroke)]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
};
