"use client";

import { useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export function AiAssistantPanel() {
  const nextIdRef = useRef(0);
  const [question, setQuestion] = useState("");
  const [rangePreset, setRangePreset] = useState<"7d" | "14d" | "30d">("14d");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function askQuestion(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    setErrorMessage(null);
    nextIdRef.current += 1;
    const userMsg: AssistantMessage = {
      id: `user-${nextIdRef.current}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          rangePreset,
        }),
      });
      const json = await response.json();

      if (!response.ok || json.error) {
        setErrorMessage(
          json.error?.message ?? "Assistant couldn't answer right now."
        );
        return;
      }

      nextIdRef.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${nextIdRef.current}`,
          role: "assistant",
          text: json.data.answer,
          limitations: json.data.limitations,
        },
      ]);
    } catch {
      setErrorMessage(
        "Couldn't reach the assistant. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Health Data Assistant
          </CardTitle>
          <CardDescription>
            Ask questions about your stored measurements and today&apos;s
            tracking progress. Tracx summarizes your recorded data only and does
            not provide medical advice.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Context window:</span>
            {(["7d", "14d", "30d"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRangePreset(preset)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  rangePreset === preset
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Last {preset.replace("d", " days")}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void askQuestion(q)}
                className="rounded-xl border border-border bg-secondary/40 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary"
              >
                {q}
              </button>
            ))}
          </div>

          {messages.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 rounded-xl px-3.5 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "ml-6 bg-primary text-primary-foreground"
                      : "mr-6 border border-border bg-card text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">
                    {msg.text}
                  </p>
                  {msg.limitations ? (
                    <p className="pt-1 text-[11px] text-muted-foreground">
                      {msg.limitations}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void askQuestion(question);
            }}
            className="flex gap-2"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about your recorded measurements..."
              aria-label="Ask AI health data assistant"
              className="h-11 flex-1"
            />
            <Button
              size="lg"
              type="submit"
              disabled={!question.trim() || loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              <span className="sr-only sm:not-sr-only">Ask</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
