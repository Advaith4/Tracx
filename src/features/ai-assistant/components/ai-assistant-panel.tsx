"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, Check, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  invalidateAllHealthQueries,
  saveExtractedMeasurements,
} from "@/features/measurements/save-extracted";
import type {
  ExtractedMeasurementItem,
  ExtractedMeasurementResponse,
} from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  limitations?: string;
  pendingRecords?: ExtractedMeasurementItem[];
  savedStatus?: "pending" | "saved" | "discarded";
}

function formatExtractedSummary(item: ExtractedMeasurementItem): string {
  if (item.kind === "glucose") {
    const ctx =
      item.meal_context === "fasting"
        ? "Fasting"
        : `${item.timing !== "unknown" ? `${item.timing} ` : ""}${item.meal_context}`;
    return `Blood Glucose: ${item.value} ${item.unit} (${ctx})`;
  }
  if (item.kind === "blood_pressure") {
    return `Blood Pressure: ${item.systolic}/${item.diastolic} mmHg${item.pulse ? ` · Pulse ${item.pulse}` : ""}`;
  }
  if (item.kind === "weight") {
    return `Weight: ${item.value} ${item.unit}`;
  }
  return `Daily Note (${item.note_date}): "${item.content}"`;
}

function looksLikeMeasurementEntry(text: string): boolean {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (trimmed.endsWith("?")) return false;
  if (/^(what|when|where|how|why|show|list|summarize|give|tell)\b/i.test(lower)) {
    return false;
  }
  const hasExplicitLogVerb = /^(log|record|save|add|enter)\b/i.test(lower);
  const hasMeasurementSignal =
    /\b(\d{2,3}\s*\/\s*\d{2,3}|glucose|sugar|fasting|breakfast|lunch|dinner|bp|blood\s*pressure|weight|kg|lb|lbs|mg\/dl|mmol)\b/i.test(
      lower
    ) && /\d/.test(lower);

  return hasExplicitLogVerb || hasMeasurementSignal;
}

const SUGGESTED_QUESTIONS = [
  "What do I still need to record today?",
  "What was my fasting sugar yesterday?",
  "Log my fasting sugar 92",
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
  const queryClient = useQueryClient();
  const nextIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [question, setQuestion] = useState("");
  const [rangePreset, setRangePreset] = useState<"7d" | "14d" | "30d">("14d");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [savingMsgId, setSavingMsgId] = useState<string | null>(null);
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
      if (looksLikeMeasurementEntry(trimmed)) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const extractRes = await fetch("/api/ai/extract-measurement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            timezone: tz,
            localNowIso: new Date().toISOString(),
          }),
        });
        if (extractRes.ok) {
          const extractJson = await extractRes.json().catch(() => null);
          const extracted = extractJson?.data as
            | ExtractedMeasurementResponse
            | undefined;

          if (extracted && !extracted.needs_clarification && extracted.records.length > 0) {
            nextIdRef.current += 1;
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${nextIdRef.current}`,
                role: "assistant",
                text: `I extracted ${extracted.records.length} reading${extracted.records.length === 1 ? "" : "s"}. Confirm below to save it across your Dashboard, Calendar, Insights, and Excel Sheet:`,
                pendingRecords: extracted.records,
                savedStatus: "pending",
              },
            ]);
            setIsThinking(false);
            return;
          }

          if (extracted?.needs_clarification && extracted.clarification_question) {
            nextIdRef.current += 1;
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${nextIdRef.current}`,
                role: "assistant",
                text: extracted.clarification_question!,
              },
            ]);
            setIsThinking(false);
            return;
          }
        }
      }

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

  async function handleConfirmPending(
    messageId: string,
    records: ExtractedMeasurementItem[]
  ) {
    setSavingMsgId(messageId);
    try {
      await saveExtractedMeasurements({ records, source: "voice" });
      invalidateAllHealthQueries(queryClient);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                savedStatus: "saved",
                text: `Saved ${records.length} reading${records.length === 1 ? "" : "s"}! Synced across your Home dashboard, Calendar, Insights, Reports, and Excel Sheet.`,
              }
            : m
        )
      );
      toast.success("Logged & synced everywhere");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Couldn't save reading."
      );
    } finally {
      setSavingMsgId(null);
    }
  }

  function handleDiscardPending(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, savedStatus: "discarded", text: "Discarded — nothing saved." }
          : m
      )
    );
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

                      {msg.pendingRecords && msg.pendingRecords.length > 0 ? (
                        <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-2.5 text-xs">
                          <ul className="flex flex-col gap-1 font-medium text-foreground">
                            {msg.pendingRecords.map((rec, recIdx) => (
                              <li key={recIdx}>
                                &bull; {formatExtractedSummary(rec)}
                              </li>
                            ))}
                          </ul>

                          {msg.savedStatus === "pending" ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <Button
                                size="sm"
                                type="button"
                                disabled={savingMsgId === msg.id}
                                onClick={() =>
                                  void handleConfirmPending(
                                    msg.id,
                                    msg.pendingRecords!
                                  )
                                }
                              >
                                <Check className="size-3.5" aria-hidden="true" />
                                {savingMsgId === msg.id
                                  ? "Saving..."
                                  : "Confirm & Log Everywhere"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                disabled={savingMsgId === msg.id}
                                onClick={() => handleDiscardPending(msg.id)}
                              >
                                <X className="size-3.5" aria-hidden="true" />
                                Discard
                              </Button>
                            </div>
                          ) : msg.savedStatus === "saved" ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              <Check className="size-3" aria-hidden="true" />
                              Synced across all views
                            </span>
                          ) : null}
                        </div>
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
          placeholder="Ask a question or type 'Log fasting sugar 92'..."
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
