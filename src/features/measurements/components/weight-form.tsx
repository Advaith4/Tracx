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
import type { Tables, WeightUnit } from "@/types/database";
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

interface WeightFormProps {
  userId?: string;
  defaultUnit?: WeightUnit;
  initialRecord?: Tables<"weight_records">;
  onSaved: () => void;
}

export function WeightForm({
  userId,
  defaultUnit = "kg",
  initialRecord,
  onSaved,
}: WeightFormProps) {
  const isEditing = Boolean(initialRecord);
  const [value, setValue] = useState(
    initialRecord ? String(initialRecord.value) : ""
  );
  const [unit, setUnit] = useState<WeightUnit>(
    initialRecord?.unit ?? defaultUnit
  );
  const [dateStr, setDateStr] = useState(() =>
    toLocalDateInputValue(initialRecord?.measured_at)
  );
  const [timeStr, setTimeStr] = useState(() =>
    toLocalTimeInputValue(initialRecord?.measured_at)
  );
  const [notes, setNotes] = useState(initialRecord?.notes ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  async function submitRecord(allowDuplicate: boolean) {
    setErrorMsg(null);
    const numValue = Number(value);
    if (!value.trim() || !Number.isFinite(numValue) || numValue <= 0) {
      setErrorMsg("Please enter a valid weight greater than zero.");
      return;
    }

    const measuredAt = combineLocalDateTimeToIso(dateStr, timeStr);
    const payload = {
      value: numValue,
      unit,
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
        metricType: "weight",
        endpoint: "/api/measurements/weight",
        summary: `${numValue} ${unit}`,
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
        ? `/api/measurements/weight/${initialRecord.id}`
        : "/api/measurements/weight";
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
        setErrorMsg(json.error?.message ?? "Couldn't save weight reading.");
        return;
      }

      setDuplicateMessage(null);
      if (!isEditing) {
        setValue("");
        setNotes("");
      }
      toast.success(
        isEditing ? "Weight reading updated" : "Weight reading saved"
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
            <Label htmlFor="weight-value">Weight</Label>
            <Input
              id="weight-value"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              placeholder={unit === "lb" ? "e.g. 142.5" : "e.g. 64.2"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-11 text-base"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weight-unit">Unit</Label>
            <Select
              value={unit}
              onValueChange={(next) => {
                if (next === "kg" || next === "lb") setUnit(next);
              }}
            >
              <SelectTrigger id="weight-unit" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lb">lb</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <MeasurementDateTimeFields
          idPrefix="weight"
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
              {isEditing ? "Update Reading" : "Save Weight"}
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
