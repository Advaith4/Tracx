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
import { MeasurementDateTimeFields } from "./measurement-common-fields";

interface CustomMetricFormProps {
  userId?: string;
  timezone?: string;
  initialNowIso?: string;
  customConfigs: Tables<"tracking_configs">[];
  defaultConfigId?: string;
  initialRecord?: Tables<"custom_metric_records">;
  onSaved: () => void;
}

export function CustomMetricForm({
  userId,
  timezone,
  initialNowIso,
  customConfigs,
  defaultConfigId,
  initialRecord,
  onSaved,
}: CustomMetricFormProps) {
  const isEditing = Boolean(initialRecord);
  const [selectedConfigId, setSelectedConfigId] = useState(
    initialRecord?.metric_config_id ?? defaultConfigId ?? customConfigs[0]?.id ?? ""
  );
  const [rawValue, setRawValue] = useState(() => {
    if (!initialRecord) return "";
    if (initialRecord.value_numeric !== null) {
      return String(initialRecord.value_numeric);
    }
    return initialRecord.value_text ?? "";
  });
  const [dateStr, setDateStr] = useState(() =>
    toLocalDateInputValue(initialRecord?.measured_at ?? initialNowIso, timezone)
  );
  const [timeStr, setTimeStr] = useState(() =>
    toLocalTimeInputValue(initialRecord?.measured_at ?? initialNowIso, timezone)
  );
  const [notes, setNotes] = useState(initialRecord?.notes ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedConfig = customConfigs.find((c) => c.id === selectedConfigId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedConfigId || !rawValue.trim()) {
      setErrorMsg("Please select a metric and enter a value.");
      return;
    }

    const trimmed = rawValue.trim();
    const numericCandidate = Number(trimmed);
    const isNumeric = trimmed.length > 0 && Number.isFinite(numericCandidate);

    const measuredAt = combineLocalDateTimeToIso(dateStr, timeStr);
    const unitVal = selectedConfig?.unit ?? initialRecord?.unit ?? null;
    const payload = {
      metric_config_id: selectedConfigId,
      value_numeric: isNumeric ? numericCandidate : null,
      value_text: isNumeric ? null : trimmed,
      unit: unitVal,
      measured_at: measuredAt,
      notes: notes.trim() || null,
      source: "manual" as const,
    };

    const queueAsOfflineDraft = () => {
      if (isEditing || !userId) return false;
      const metricName = selectedConfig?.custom_label || "Custom";
      enqueueMeasurementDraft({
        userId,
        metricType: "custom",
        endpoint: "/api/measurements/custom",
        summary: `${metricName}: ${trimmed}${unitVal ? ` ${unitVal}` : ""}`,
        measuredAt,
        payload,
      });
      setRawValue("");
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
        ? `/api/measurements/custom/${initialRecord.id}`
        : "/api/measurements/custom";
      const response = await fetch(url, {
        method: initialRecord ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok || json.error) {
        setErrorMsg(json.error?.message ?? "Couldn't save custom reading.");
        return;
      }

      if (!isEditing) {
        setRawValue("");
        setNotes("");
      }
      toast.success(
        isEditing ? "Custom reading updated" : "Custom reading saved"
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errorMsg ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="custom-metric-select">Metric</Label>
          <Select
            value={selectedConfigId}
            disabled={isEditing}
            onValueChange={(next) => {
              if (next) setSelectedConfigId(next);
            }}
          >
            <SelectTrigger id="custom-metric-select" className="h-11 w-full">
              <SelectValue placeholder="Choose metric">
                {(value: string | null) => {
                  const match = customConfigs.find((cfg) => cfg.id === value);
                  return match
                    ? `${match.custom_label || "Custom"} (${match.unit})`
                    : "Choose metric";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {customConfigs.map((cfg) => (
                <SelectItem key={cfg.id} value={cfg.id}>
                  {cfg.custom_label || "Custom"} ({cfg.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="custom-metric-value">
            Value {selectedConfig?.unit ? `(${selectedConfig.unit})` : ""}
          </Label>
          <Input
            id="custom-metric-value"
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            placeholder="Enter number or observation"
            className="h-11"
            required
          />
        </div>
      </div>

      <MeasurementDateTimeFields
        idPrefix="custom"
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
            {isEditing ? "Update Reading" : "Save Measurement"}
          </>
        )}
      </Button>
    </form>
  );
}
