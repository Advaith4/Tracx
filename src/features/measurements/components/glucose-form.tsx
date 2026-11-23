"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GlucoseUnit, MealContext, MealTiming, Tables } from "@/types/database";
import {
  enqueueMeasurementDraft,
  isOfflineOrNetworkError,
} from "@/lib/offline/draft-queue";
import {
  combineLocalDateTimeToIso,
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from "./datetime-utils";
import {
  DuplicateConfirmDialog,
  MeasurementDateTimeFields,
} from "./measurement-common-fields";

type ContextPresetKey =
  | "fasting"
  | "before_breakfast"
  | "after_breakfast"
  | "before_lunch"
  | "after_lunch"
  | "before_dinner"
  | "after_dinner"
  | "snack"
  | "unknown";

const CONTEXT_PRESETS: Array<{
  key: ContextPresetKey;
  label: string;
  meal_context: MealContext;
  timing: MealTiming;
}> = [
  { key: "fasting", label: "Fasting", meal_context: "fasting", timing: "unknown" },
  {
    key: "before_breakfast",
    label: "Before breakfast",
    meal_context: "breakfast",
    timing: "before",
  },
  {
    key: "after_breakfast",
    label: "After breakfast",
    meal_context: "breakfast",
    timing: "after",
  },
  {
    key: "before_lunch",
    label: "Before lunch",
    meal_context: "lunch",
    timing: "before",
  },
  {
    key: "after_lunch",
    label: "After lunch",
    meal_context: "lunch",
    timing: "after",
  },
  {
    key: "before_dinner",
    label: "Before dinner",
    meal_context: "dinner",
    timing: "before",
  },
  {
    key: "after_dinner",
    label: "After dinner",
    meal_context: "dinner",
    timing: "after",
  },
  { key: "snack", label: "Snack", meal_context: "snack", timing: "after" },
  { key: "unknown", label: "General / Other", meal_context: "unknown", timing: "unknown" },
];

function inferPresetFromRecordOrQuery(
  record?: Tables<"glucose_records">,
  contextHint?: string | null
): ContextPresetKey {
  if (record) {
    if (record.meal_context === "fasting") return "fasting";
    if (record.meal_context === "snack") return "snack";
    if (record.meal_context === "unknown") return "unknown";
    const match = CONTEXT_PRESETS.find(
      (p) => p.meal_context === record.meal_context && p.timing === record.timing
    );
    return match?.key ?? "unknown";
  }

  if (contextHint) {
    const lower = contextHint.toLowerCase();
    if (lower.includes("fasting")) return "fasting";
    if (lower.includes("breakfast")) {
      return lower.includes("before") ? "before_breakfast" : "after_breakfast";
    }
    if (lower.includes("lunch")) {
      return lower.includes("before") ? "before_lunch" : "after_lunch";
    }
    if (lower.includes("dinner")) {
      return lower.includes("before") ? "before_dinner" : "after_dinner";
    }
  }

  return "fasting";
}

interface GlucoseFormProps {
  userId?: string;
  timezone?: string;
  initialNowIso?: string;
  defaultUnit?: GlucoseUnit;
  contextHint?: string | null;
  initialRecord?: Tables<"glucose_records">;
  onSaved: () => void;
}

export function GlucoseForm({
  userId,
  timezone,
  initialNowIso,
  defaultUnit = "mg/dL",
  contextHint,
  initialRecord,
  onSaved,
}: GlucoseFormProps) {
  const isEditing = Boolean(initialRecord);
  const [value, setValue] = useState(
    initialRecord ? String(initialRecord.value) : ""
  );
  const [unit, setUnit] = useState<GlucoseUnit>(
    initialRecord?.unit ?? defaultUnit
  );
  const [presetKey, setPresetKey] = useState<ContextPresetKey>(() =>
    inferPresetFromRecordOrQuery(initialRecord, contextHint)
  );
  const [elapsedMinutes, setElapsedMinutes] = useState(
    initialRecord?.elapsed_minutes ? String(initialRecord.elapsed_minutes) : "60"
  );
  const [dateStr, setDateStr] = useState(() =>
    toLocalDateInputValue(initialRecord?.measured_at ?? initialNowIso, timezone)
  );
  const [timeStr, setTimeStr] = useState(() =>
    toLocalTimeInputValue(initialRecord?.measured_at ?? initialNowIso, timezone)
  );
  const [notes, setNotes] = useState(initialRecord?.notes ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  const selectedPreset =
    CONTEXT_PRESETS.find((p) => p.key === presetKey) ?? CONTEXT_PRESETS[0];

  async function submitRecord(allowDuplicate: boolean) {
    setErrorMsg(null);
    const numValue = Number(value);
    if (!value.trim() || !Number.isFinite(numValue) || numValue <= 0) {
      setErrorMsg("Please enter a valid glucose reading greater than zero.");
      return;
    }

    const measuredAt = combineLocalDateTimeToIso(dateStr, timeStr);
    const payload = {
      value: numValue,
      unit,
      meal_context: selectedPreset.meal_context,
      timing: selectedPreset.timing,
      elapsed_minutes:
        selectedPreset.timing === "after" && elapsedMinutes.trim()
          ? Number(elapsedMinutes)
          : null,
      measured_at: measuredAt,
      notes: notes.trim() || null,
      source: "manual" as const,
      allowDuplicate,
    };

    const queueAsOfflineDraft = () => {
      if (isEditing || !userId) return false;
      const { allowDuplicate: _ignored, ...draftPayload } = payload;
      void _ignored;
      enqueueMeasurementDraft({
        userId,
        metricType: "glucose",
        endpoint: "/api/measurements/glucose",
        summary: `${numValue} ${unit} (${selectedPreset.label})`,
        measuredAt,
        payload: draftPayload,
      });
      setDuplicateMessage(null);
      setValue("");
      setNotes("");
      toast.info(
        "You're offline — saved reading to your draft queue for syncing later."
      );
      return true;
    };

    if (!isEditing && userId && isOfflineOrNetworkError()) {
      queueAsOfflineDraft();
      return;
    }

    setIsSubmitting(true);
    try {
      const url = initialRecord
        ? `/api/measurements/glucose/${initialRecord.id}`
        : "/api/measurements/glucose";
      const response = await fetch(url, {
        method: initialRecord ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (response.status === 409 && json.error?.code === "POTENTIAL_DUPLICATE") {
        setDuplicateMessage(json.error.message);
        return;
      }

      if (!response.ok || json.error) {
        setErrorMsg(json.error?.message ?? "Couldn't save glucose reading.");
        return;
      }

      setDuplicateMessage(null);
      if (!isEditing) {
        setValue("");
        setNotes("");
      }
      toast.success(
        isEditing ? "Glucose reading updated" : "Glucose reading saved"
      );
      onSaved();
    } catch (error) {
      if (isOfflineOrNetworkError(error) && queueAsOfflineDraft()) {
        return;
      }
      setErrorMsg("Couldn't save your measurement. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitRecord(false);
        }}
        className="flex flex-col gap-4"
      >
        {errorMsg ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {errorMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="glucose-value">Blood glucose</Label>
            <Input
              id="glucose-value"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              placeholder={unit === "mmol/L" ? "e.g. 5.2" : "e.g. 94"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-11 text-base"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="glucose-unit">Unit</Label>
            <Select
              value={unit}
              onValueChange={(next) => {
                if (next === "mg/dL" || next === "mmol/L") setUnit(next);
              }}
            >
              <SelectTrigger id="glucose-unit" className="h-11 w-full">
                <SelectValue>
                  {(value: string | null) => value || "mg/dL"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mg/dL">mg/dL</SelectItem>
                <SelectItem value="mmol/L">mmol/L</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="glucose-context">Meal context</Label>
            <Select
              value={presetKey}
              onValueChange={(next) => {
                if (next) setPresetKey(next as ContextPresetKey);
              }}
            >
              <SelectTrigger id="glucose-context" className="h-11 w-full">
                <SelectValue>
                  {(value: string | null) =>
                    CONTEXT_PRESETS.find((p) => p.key === value)?.label ??
                    "Fasting"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTEXT_PRESETS.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPreset.timing === "after" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="glucose-elapsed">Time after meal (mins)</Label>
              <Input
                id="glucose-elapsed"
                type="number"
                inputMode="numeric"
                min="0"
                max="600"
                step="15"
                placeholder="e.g. 60 or 120"
                value={elapsedMinutes}
                onChange={(e) => setElapsedMinutes(e.target.value)}
                className="h-11"
              />
            </div>
          ) : null}
        </div>

        <MeasurementDateTimeFields
          idPrefix="glucose"
          dateValue={dateStr}
          timeValue={timeStr}
          notesValue={notes}
          onDateChange={setDateStr}
          onTimeChange={setTimeStr}
          onNotesChange={setNotes}
        />

        <Button size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden="true" />
              {isEditing ? "Update Reading" : "Save Glucose Reading"}
            </>
          )}
        </Button>
      </form>

      <DuplicateConfirmDialog
        open={Boolean(duplicateMessage)}
        message={duplicateMessage ?? ""}
        isSubmitting={isSubmitting}
        onCancel={() => setDuplicateMessage(null)}
        onConfirm={() => void submitRecord(true)}
      />
    </>
  );
}
