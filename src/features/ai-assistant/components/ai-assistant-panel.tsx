"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  limitations?: string;
}

const SUGGESTED_QUESTIONS = [
  "What do I still need to record today?",
  "What was my fasting sugar yesterday?",
  "Summarize my records for the last seven days.",
  "Show me my blood pressure history.",
];

const THINKING_PHRASES = [
  "Checking your records...",
  "Reviewing trends...",
  "Drafting reply...",
];

interface AiAssistantPanelProps {
  compact?: boolean;
}

export function AiAssistantPanel({ compact = false }: AiAssistantPanelProps) {
  const nextIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [question, setQuestion] = useState("");
  const [rangePreset, setRangePreset] = useState<"7d" | "14d" | "30d">("14d");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isThinking) return;
    const interval = window.setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 1100);
    return () => window.clearInterval(interval);
  }, [isThinking]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking, isStreaming]);

  async function askQuestion(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || isThinking || isStreaming) return;

    setErrorMessage(null);
    setThinkingStep(0);
    nextIdRef.current += 1;
    const userMsg: AssistantMessage = {
      id: `user-${nextIdRef.current}`,
      role: "user",
      text: trimmed,
    };

    const recentHistory = messages.slice(-6).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsThinking(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          rangePreset,
          history: recentHistory,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        setErrorMessage(
          json?.error?.message ?? "Assistant couldn't answer right now."
        );
        setIsThinking(false);
        return;
      }

      const limitationsHeader = response.headers.get("X-Tracx-Limitations");
      const limitations = limitationsHeader
        ? decodeURIComponent(limitationsHeader)
        : undefined;

      const reader = response.body?.getReader();
      if (!reader) {
        const fallbackText = await response.text();
        nextIdRef.current += 1;
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${nextIdRef.current}`,
            role: "assistant",
            text: fallbackText,
            limitations,
          },
        ]);
        setIsThinking(false);
        return;
      }

      const decoder = new TextDecoder();
      nextIdRef.current += 1;
      const assistantId = `assistant-${nextIdRef.current}`;
      let buffer = "";
      let createdBubble = false;

      const commitText = (nextSnapshot: string) => {
        if (!createdBubble) {
          createdBubble = true;
          setIsThinking(false);
          setIsStreaming(true);
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              text: nextSnapshot,
              limitations,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: nextSnapshot } : m
            )
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        buffer = `${buffer}${chunk}`;
        commitText(buffer);
      }

      const tail = decoder.decode();
      if (tail) {
        buffer = `${buffer}${tail}`;
        commitText(buffer);
      }
    } catch {
      setErrorMessage(
        "Couldn't reach the assistant. Check your connection and try again."
      );
    } finally {
      setIsThinking(false);
      setIsStreaming(false);
    }
  }

  const isBusy = isThinking || isStreaming;

  const chatBody = (
    <div
      className={cn(
        "flex flex-col",
        compact ? "h-full min-h-0 flex-1" : "h-[66dvh] min-h-[420px]"
      )}
    >
      {/* Slim toolbar: window + reset */}
      <div className="flex shrink-0 items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
          {(["7d", "14d", "30d"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRangePreset(preset)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                rangePreset === preset
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {preset}
            </button>
          ))}
        </div>

        {messages.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              setMessages([]);
              setErrorMessage(null);
            }}
            className="h-7 gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            New chat
          </Button>
        ) : null}
      </div>

      {/* Open scrollable conversation canvas */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {messages.length === 0 && !isThinking ? (
          <div className="flex h-full flex-col justify-center gap-5 py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Ask about your health records
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                Instant answers grounded in your saved readings and daily
                schedule.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void askQuestion(q)}
                  className="rounded-xl bg-muted/45 px-3.5 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 py-2">
            {messages.map((msg, idx) => {
              const isLastAssistant =
                msg.role === "assistant" && idx === messages.length - 1;
              return msg.role === "user" ? (
                <div
                  key={msg.id}
                  className="ml-auto w-fit max-w-[82%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-2xs animate-in fade-in slide-in-from-bottom-1 duration-200"
                >
                  {msg.text}
                </div>
              ) : (
                <div
                  key={msg.id}
                  className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 max-w-[88%] flex-col gap-1">
                    <div className="rounded-2xl rounded-tl-sm bg-muted/55 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                      <span className="whitespace-pre-line">{msg.text}</span>
                      {isStreaming && isLastAssistant ? (
                        <span
                          aria-hidden="true"
                          className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-xs bg-primary/75 align-middle"
                        />
                      ) : null}
                    </div>
                    {msg.limitations && !(isStreaming && isLastAssistant) ? (
                      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                        {msg.limitations}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {isThinking ? (
              <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <span className="mt-0.5 flex size-7 shrink-0 animate-pulse items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                </span>
                <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-sm bg-muted/55 px-3.5 py-2.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:0ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:150ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:300ms]" />
                  </span>
                  <span>{THINKING_PHRASES[thinkingStep]}</span>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive animate-in fade-in duration-150"
              >
                {errorMessage}
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Sleek composer bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void askQuestion(question);
        }}
        className="mt-3 flex shrink-0 items-center gap-2 rounded-2xl bg-muted/50 p-1.5 ring-1 ring-border/70 transition-shadow focus-within:ring-2 focus-within:ring-ring/50"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your measurements..."
          aria-label="Ask AI health data assistant"
          className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Button
          size="icon"
          type="submit"
          disabled={!question.trim() || isBusy}
          aria-label="Send message"
          className="size-9 shrink-0 rounded-xl"
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );

  if (compact) {
    return chatBody;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Health Data Assistant
        </CardTitle>
        <CardDescription>
          Ask questions about your stored measurements and today&apos;s tracking
          progress. Tracx summarizes your recorded data only and does not
          provide medical advice.
        </CardDescription>
      </CardHeader>

      <CardContent>{chatBody}</CardContent>
    </Card>
  );
}
