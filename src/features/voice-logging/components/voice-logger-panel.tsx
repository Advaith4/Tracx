"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ExtractedMeasurementItem,
  ExtractedMeasurementResponse,
} from "@/lib/ai/schemas";
import type {
  GlucoseUnit,
  MealContext,
  MealTiming,
  WeightUnit,
} from "@/types/database";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

const emptySubscribe = () => () => {};

interface VoiceLoggerPanelProps {
  timezone: string;
  autoFocusVoice?: boolean;
  onSaved: () => void;
}

export function VoiceLoggerPanel({
  timezone,
  autoFocusVoice = false,
  onSaved,
}: VoiceLoggerPanelProps) {
  const speechSupported = useSyncExternalStore(
    emptySubscribe,
    () => Boolean(getSpeechRecognitionCtor()),
    () => false
  );

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [clarificationReply, setClarificationReply] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState<
    string | null
  >(null);
  const [draftRecords, setDraftRecords] = useState<ExtractedMeasurementItem[]>(
    []
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function startListening() {
    setErrorMessage(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setErrorMessage(
        "Voice recognition isn't available in this browser. You can type below or use Manual Entry."
      );
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const chunks: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          chunks.push(event.results[i][0].transcript);
        }
        setTranscript(chunks.join(" ").trim());
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          setErrorMessage(
            "Microphone permission was denied. You can still type your measurement below or log manually."
          );
        } else {
          setErrorMessage(
            "Couldn't capture speech clearly. You can retry, edit the text, or log manually."
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setUsedVoice(true);
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setErrorMessage(
        "Couldn't start voice recording. Please type below or enter manually."
      );
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  async function handleExtract(inputText: string) {
    if (!inputText.trim()) return;
    setErrorMessage(null);
    setExtracting(true);
    try {
      const response = await fetch("/api/ai/extract-measurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText.trim(),
          localNowIso: new Date().toISOString(),
          timezone,
        }),
      });
      const json = await response.json();

      if (!response.ok || json.error) {
        setErrorMessage(
          json.error?.message ??
            "Couldn't extract measurements. Please enter manually."
        );
        return;
      }

      const payload = json.data as ExtractedMeasurementResponse;
      if (payload.needs_clarification) {
        setClarificationQuestion(
          payload.clarification_question ??
            "Could you clarify the measurement value or meal context?"
        );
        setDraftRecords(payload.records ?? []);
        return;
      }

      setClarificationQuestion(null);
      setClarificationReply("");
      if (payload.records.length === 0) {
        setErrorMessage(
          "No measurements were detected in that note. Try including a number and type (e.g. 'fasting sugar 92')."
        );
        return;
      }
      setDraftRecords(payload.records);
    } catch {
      setErrorMessage(
        "Extraction failed. Please check your connection or use Manual Entry."
      );
    } finally {
      setExtracting(false);
    }
  }

  function updateDraft(index: number, patch: Partial<ExtractedMeasurementItem>) {
    setDraftRecords((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? ({ ...item, ...patch } as ExtractedMeasurementItem)
          : item
      )
    );
  }

  function removeDraft(index: number) {
    setDraftRecords((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleConfirmAll() {
    if (draftRecords.length === 0) return;
    setSavingAll(true);
    setErrorMessage(null);

    const source = usedVoice ? "voice" : "manual";

    try {
      for (const record of draftRecords) {
        let url = "";
        let payload: Record<string, unknown> = {};
        let method = "POST";

        if (record.kind === "glucose") {
          url = "/api/measurements/glucose";
          payload = {
            value: record.value,
            unit: record.unit,
            meal_context: record.meal_context,
            timing: record.timing,
            elapsed_minutes: record.elapsed_minutes,
            measured_at: record.measured_at_iso,
            notes: record.notes,
            source,
            allowDuplicate: true,
          };
        } else if (record.kind === "blood_pressure") {
          url = "/api/measurements/blood-pressure";
          payload = {
            systolic: record.systolic,
            diastolic: record.diastolic,
            pulse: record.pulse,
            measured_at: record.measured_at_iso,
            notes: record.notes,
            source,
            allowDuplicate: true,
          };
        } else if (record.kind === "weight") {
          url = "/api/measurements/weight";
          payload = {
            value: record.value,
            unit: record.unit,
            measured_at: record.measured_at_iso,
            notes: record.notes,
            source,
            allowDuplicate: true,
          };
        } else {
          url = "/api/daily-notes";
          method = "PUT";
          payload = {
            note_date: record.note_date,
            content: record.content,
          };
        }

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? "Failed to save record.");
        }
      }

      toast.success(
        `Saved ${draftRecords.length} ${draftRecords.length === 1 ? "record" : "records"}`
      );
      setDraftRecords([]);
      setTranscript("");
      setClarificationQuestion(null);
      setClarificationReply("");
      setUsedVoice(false);
      onSaved();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Couldn't save all extracted records."
      );
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <Card className={autoFocusVoice ? "ring-2 ring-primary/40" : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Voice &amp; Natural Language Logging
            </CardTitle>
            <CardDescription>
              Speak or type naturally — e.g. &ldquo;My fasting sugar today is 92
              and blood pressure 118 over 76.&rdquo;
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {isListening ? (
            <Button
              size="lg"
              variant="destructive"
              type="button"
              onClick={stopListening}
            >
              <MicOff className="size-4" aria-hidden="true" />
              Stop Listening
            </Button>
          ) : (
            <Button
              size="lg"
              type="button"
              disabled={!speechSupported || extracting}
              onClick={startListening}
            >
              <Mic className="size-4" aria-hidden="true" />
              {speechSupported
                ? "Tap to Speak"
                : "Voice Unsupported in Browser"}
            </Button>
          )}

          {isListening ? (
            <span className="text-xs font-medium text-primary animate-pulse">
              Listening... speak naturally
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="voice-transcript">Transcript / Note</Label>
          <Textarea
            id="voice-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your spoken words appear here, or type naturally (e.g. 'My sugar 1 hour after breakfast was 126')"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            {transcript ? (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => {
                  setTranscript("");
                  setDraftRecords([]);
                  setClarificationQuestion(null);
                  setErrorMessage(null);
                }}
              >
                Clear
              </Button>
            ) : null}
            <Button
              size="lg"
              variant="secondary"
              type="button"
              disabled={!transcript.trim() || extracting}
              onClick={() => void handleExtract(transcript)}
            >
              {extracting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Extracting...
                </>
              ) : (
                "Extract & Review"
              )}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}

        {clarificationQuestion ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-medium text-foreground">
              {clarificationQuestion}
            </p>
            <div className="flex gap-2">
              <Input
                value={clarificationReply}
                onChange={(e) => setClarificationReply(e.target.value)}
                placeholder="Type clarification (e.g. 'After breakfast, 1 hour')"
                className="h-10 bg-card"
              />
              <Button
                size="default"
                type="button"
                disabled={!clarificationReply.trim() || extracting}
                onClick={() => {
                  const combined = `${transcript.trim()} (${clarificationReply.trim()})`;
                  setTranscript(combined);
                  setClarificationReply("");
                  void handleExtract(combined);
                }}
              >
                Clarify
              </Button>
            </div>
          </div>
        ) : null}

        {draftRecords.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Review &amp; Confirm ({draftRecords.length})
              </h3>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setDraftRecords([])}
              >
                <X className="size-3.5" aria-hidden="true" />
                Cancel
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {draftRecords.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {item.kind.replace("_", " ")}
                    </span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      type="button"
                      aria-label="Remove extracted item"
                      onClick={() => removeDraft(index)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>

                  {item.kind === "glucose" ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input
                        type="number"
                        step="0.1"
                        value={item.value}
                        onChange={(e) =>
                          updateDraft(index, { value: Number(e.target.value) })
                        }
                        aria-label="Extracted glucose value"
                        className="h-10"
                      />
                      <Select
                        value={item.unit}
                        onValueChange={(next) => {
                          if (next) {
                            updateDraft(index, { unit: next as GlucoseUnit });
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue>
                            {(value: string | null) => value || "mg/dL"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mg/dL">mg/dL</SelectItem>
                          <SelectItem value="mmol/L">mmol/L</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={item.meal_context}
                        onValueChange={(next) => {
                          if (next) {
                            updateDraft(index, {
                              meal_context: next as MealContext,
                              timing:
                                next === "fasting"
                                  ? ("unknown" as MealTiming)
                                  : item.timing,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue>
                            {(value: string | null) =>
                              value === "fasting"
                                ? "Fasting"
                                : value === "breakfast"
                                  ? "Breakfast"
                                  : value === "lunch"
                                    ? "Lunch"
                                    : value === "dinner"
                                      ? "Dinner"
                                      : value === "snack"
                                        ? "Snack"
                                        : "General"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fasting">Fasting</SelectItem>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                          <SelectItem value="snack">Snack</SelectItem>
                          <SelectItem value="unknown">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : item.kind === "blood_pressure" ? (
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        value={item.systolic}
                        onChange={(e) =>
                          updateDraft(index, {
                            systolic: Number(e.target.value),
                          })
                        }
                        aria-label="Extracted systolic"
                        className="h-10"
                      />
                      <Input
                        type="number"
                        value={item.diastolic}
                        onChange={(e) =>
                          updateDraft(index, {
                            diastolic: Number(e.target.value),
                          })
                        }
                        aria-label="Extracted diastolic"
                        className="h-10"
                      />
                      <Input
                        type="number"
                        placeholder="Pulse"
                        value={item.pulse ?? ""}
                        onChange={(e) =>
                          updateDraft(index, {
                            pulse: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        aria-label="Extracted pulse"
                        className="h-10"
                      />
                    </div>
                  ) : item.kind === "weight" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={item.value}
                        onChange={(e) =>
                          updateDraft(index, { value: Number(e.target.value) })
                        }
                        aria-label="Extracted weight"
                        className="h-10"
                      />
                      <Select
                        value={item.unit}
                        onValueChange={(next) => {
                          if (next) {
                            updateDraft(index, { unit: next as WeightUnit });
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue>
                            {(value: string | null) => value || "kg"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="lb">lb</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <Input
                      value={item.content}
                      onChange={(e) =>
                        updateDraft(index, { content: e.target.value })
                      }
                      aria-label="Extracted note"
                      className="h-10"
                    />
                  )}
                </div>
              ))}
            </div>

            <Button
              size="lg"
              type="button"
              disabled={savingAll}
              onClick={() => void handleConfirmAll()}
            >
              {savingAll ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Confirm &amp; Save
                </>
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
