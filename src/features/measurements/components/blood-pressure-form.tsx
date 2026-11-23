"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/types/database";
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

interface BloodPressureFormProps {
  userId?: string;
  timezone?: string;
  initialNowIso?: string;
  initialRecord?: Tables<"blood_pressure_records">;
  onSaved: () => void;
}

export function BloodPressureForm({
  userId,
  timezone,
  initialNowIso,
  initialRecord,
  onSaved,
}: BloodPressureFormProps) {
  const isEditing = Boolean(initialRecord);
  const [systolic, setSystolic] = useState(
    initialRecord ? String(initialRecord.systolic) : ""
  );
  const [diastolic, setDiastolic] = useState(
    initialRecord ? String(initialRecord.diastolic) : ""
  );
  const [pulse, setPulse] = useState(
    initialRecord?.pulse ? String(initialRecord.pulse) : ""
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

  async function submitRecord(allowDuplicate: boolean) {
    setErrorMsg(null);
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const pulseNum = pulse.trim() ? Number(pulse) : null;

    if (!Number.isInteger(sys) || !Number.isInteger(dia)) {
      setErrorMsg("Please enter whole numbers for systolic and diastolic.");
      return;
    }

    const measuredAt = combineLocalDateTimeToIso(dateStr, timeStr);
    const payload = {
      systolic: sys,
      diastolic: dia,
      pulse: pulseNum,
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
        metricType: "blood_pressure",
        endpoint: "/api/measurements/blood-pressure",
        summary: pulseNum
          ? `${sys}/${dia} mmHg · ${pulseNum} bpm`
          : `${sys}/${dia} mmHg`,
        measuredAt,
        payload: draftPayload,
      });
      setDuplicateMessage(null);
      setSystolic("");
      setDiastolic("");
      setPulse("");
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
        ? `/api/measurements/blood-pressure/${initialRecord.id}`
        : "/api/measurements/blood-pressure";
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
        setErrorMsg(
          json.error?.message ?? "Couldn't save blood pressure reading."
        );
        return;
      }

      setDuplicateMessage(null);
      if (!isEditing) {
        setSystolic("");
        setDiastolic("");
        setPulse("");
        setNotes("");
      }
      toast.success(
        isEditing
          ? "Blood pressure reading updated"
          : "Blood pressure reading saved"
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-systolic">Systolic (top)</Label>
            <Input
              id="bp-systolic"
              type="number"
              inputMode="numeric"
              min="40"
              max="300"
              placeholder="e.g. 118"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              className="h-11 text-base"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-diastolic">Diastolic (bottom)</Label>
            <Input
              id="bp-diastolic"
              type="number"
              inputMode="numeric"
              min="20"
              max="200"
              placeholder="e.g. 76"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              className="h-11 text-base"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-pulse">Pulse (optional)</Label>
            <Input
              id="bp-pulse"
              type="number"
              inputMode="numeric"
              min="20"
              max="250"
              placeholder="e.g. 74 bpm"
              value={pulse}
              onChange={(e) => setPulse(e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        <MeasurementDateTimeFields
          idPrefix="bp"
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
              {isEditing ? "Update Reading" : "Save Blood Pressure"}
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
