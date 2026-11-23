"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/types/database";
import {
  BLOOD_PRESSURE_CONTEXT_PRESETS,
  GLUCOSE_CONTEXT_PRESETS,
  SUPPORTED_UNITS_BY_METRIC,
  WEIGHT_CONTEXT_PRESETS,
  type ScheduleSlot,
  type UpdateTrackingConfigValues,
} from "../schemas";
import {
  getMetricDisplayName,
  parseProviderTargets,
  parseSchedule,
} from "../schedule-utils";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

interface MetricConfigCardProps {
  config: Tables<"tracking_configs">;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (values: UpdateTrackingConfigValues) => void;
  onDelete?: (id: string) => void;
}

export function MetricConfigCard({
  config,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
}: MetricConfigCardProps) {
  const initialSchedule = parseSchedule(config.schedule);
  const initialTargets = parseProviderTargets(config.provider_targets);

  const [enabled, setEnabled] = useState(config.enabled);
  const [customLabel, setCustomLabel] = useState(config.custom_label ?? "");
  const [unit, setUnit] = useState(config.unit);
  const [showOnDashboard, setShowOnDashboard] = useState(
    config.show_on_dashboard
  );
  const [includeInReports, setIncludeInReports] = useState(
    config.include_in_reports
  );
  const [slots, setSlots] = useState<ScheduleSlot[]>(initialSchedule.slots);
  const [targetNote, setTargetNote] = useState(initialTargets?.note ?? "");
  const [fastingMax, setFastingMax] = useState(
    initialTargets?.fastingMax ? String(initialTargets.fastingMax) : ""
  );
  const [postMealMax, setPostMealMax] = useState(
    initialTargets?.postMealMax ? String(initialTargets.postMealMax) : ""
  );
  const [systolicMax, setSystolicMax] = useState(
    initialTargets?.systolicMax ? String(initialTargets.systolicMax) : ""
  );
  const [diastolicMax, setDiastolicMax] = useState(
    initialTargets?.diastolicMax ? String(initialTargets.diastolicMax) : ""
  );

  const supportedUnits = SUPPORTED_UNITS_BY_METRIC[config.metric_type];
  const displayName = getMetricDisplayName({
    metric_type: config.metric_type,
    custom_label: customLabel,
  });

  const contextSuggestions =
    config.metric_type === "glucose"
      ? GLUCOSE_CONTEXT_PRESETS
      : config.metric_type === "blood_pressure"
        ? BLOOD_PRESSURE_CONTEXT_PRESETS
        : WEIGHT_CONTEXT_PRESETS;

  function handleAddSlot() {
    const newId = `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const defaultContext =
      config.metric_type === "glucose" ? "After lunch" : "Morning";

    setSlots((prev) => [
      ...prev,
      {
        id: newId,
        context: defaultContext,
        time: "09:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        postMealMinutes: config.metric_type === "glucose" ? 60 : null,
      },
    ]);
  }

  function handleRemoveSlot(slotId: string) {
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }

  function handleUpdateSlot(slotId: string, patch: Partial<ScheduleSlot>) {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot))
    );
  }

  function handleToggleDay(slotId: string, day: number) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== slotId) return slot;
        const hasDay = slot.daysOfWeek.includes(day);
        if (hasDay && slot.daysOfWeek.length === 1) {
          return slot;
        }
        const nextDays = hasDay
          ? slot.daysOfWeek.filter((d) => d !== day)
          : [...slot.daysOfWeek, day].sort((a, b) => a - b);
        return { ...slot, daysOfWeek: nextDays };
      })
    );
  }

  function handleSubmit() {
    const uniqueContexts = Array.from(
      new Set(slots.map((s) => s.context.trim()).filter(Boolean))
    );

    const parseOptNum = (raw: string) => {
      const n = Number(raw.trim());
      return raw.trim() && Number.isFinite(n) && n > 0 ? n : null;
    };

    const nextTargets = {
      ...(targetNote.trim() ? { note: targetNote.trim() } : {}),
      ...(config.metric_type === "glucose"
        ? {
            fastingMax: parseOptNum(fastingMax),
            postMealMax: parseOptNum(postMealMax),
          }
        : {}),
      ...(config.metric_type === "blood_pressure"
        ? {
            systolicMax: parseOptNum(systolicMax),
            diastolicMax: parseOptNum(diastolicMax),
          }
        : {}),
    };

    const hasTargets =
      Boolean(nextTargets.note) ||
      nextTargets.fastingMax != null ||
      nextTargets.postMealMax != null ||
      nextTargets.systolicMax != null ||
      nextTargets.diastolicMax != null;

    onSave({
      id: config.id,
      custom_label:
        config.metric_type === "custom" ? customLabel.trim() || null : null,
      enabled,
      unit: unit.trim() || "unit",
      show_on_dashboard: showOnDashboard,
      include_in_reports: includeInReports,
      schedule: {
        contexts:
          uniqueContexts.length > 0
            ? uniqueContexts
            : initialSchedule.contexts,
        slots,
      },
      provider_targets: hasTargets ? nextTargets : null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{displayName}</CardTitle>
            <CardDescription>
              Configure unit, daily check-in schedule, and visibility.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`enable-${config.id}`}
              className="text-xs text-muted-foreground"
            >
              {enabled ? "Active" : "Paused"}
            </Label>
            <Switch
              id={`enable-${config.id}`}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {config.metric_type === "custom" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`label-${config.id}`}>Metric name</Label>
              <Input
                id={`label-${config.id}`}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="h-11"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`unit-${config.id}`}>Measurement unit</Label>
            {supportedUnits ? (
              <Select
                value={unit}
                onValueChange={(value) => {
                  if (value) setUnit(value);
                }}
              >
                <SelectTrigger id={`unit-${config.id}`} className="h-11 w-full">
                  <SelectValue placeholder="Select unit">
                    {(value: string | null) => value || "Select unit"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {supportedUnits.map((supportedUnit) => (
                    <SelectItem key={supportedUnit} value={supportedUnit}>
                      {supportedUnit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`unit-${config.id}`}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. °C, bpm, mL"
                className="h-11"
              />
            )}
          </div>

          <div className="flex flex-col justify-end gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-start sm:gap-6">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Switch
                checked={showOnDashboard}
                onCheckedChange={setShowOnDashboard}
              />
              <span>Show on Dashboard</span>
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Switch
                checked={includeInReports}
                onCheckedChange={setIncludeInReports}
              />
              <span>Include in Weekly Reports</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Scheduled Check-ins</Label>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleAddSlot}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add slot
            </Button>
          </div>

          {slots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3.5 py-3 text-xs text-muted-foreground">
              No scheduled check-ins configured. You can still log readings
              anytime, or add a slot above.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/35 p-3.5"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">
                        Context
                      </Label>
                      <Input
                        value={slot.context}
                        onChange={(e) =>
                          handleUpdateSlot(slot.id, { context: e.target.value })
                        }
                        placeholder="e.g. Fasting, After breakfast"
                        className="h-10 bg-card"
                      />
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {contextSuggestions
                          .filter((preset) => preset !== "Custom")
                          .slice(0, 4)
                          .map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                handleUpdateSlot(slot.id, { context: preset })
                              }
                              className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {preset}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Time
                      </Label>
                      <Input
                        type="time"
                        value={slot.time}
                        onChange={(e) =>
                          handleUpdateSlot(slot.id, { time: e.target.value })
                        }
                        className="h-10 bg-card"
                      />
                    </div>
                  </div>

                  {config.metric_type === "glucose" ? (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Post-meal timing (optional, mins):
                      </Label>
                      <Input
                        type="number"
                        min={15}
                        max={240}
                        step={15}
                        placeholder="e.g. 60"
                        value={slot.postMealMinutes ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          handleUpdateSlot(slot.id, {
                            postMealMinutes: raw ? Number(raw) : null,
                          });
                        }}
                        className="h-9 w-24 bg-card"
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {DAY_LABELS.map((dayLabel, dayIndex) => {
                        const selected = slot.daysOfWeek.includes(dayIndex);
                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={() => handleToggleDay(slot.id, dayIndex)}
                            aria-pressed={selected}
                            className={`flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-card text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {dayLabel}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => handleRemoveSlot(slot.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor={`targets-${config.id}`}>
            Healthcare provider instructions or reference targets (optional)
          </Label>
          {config.metric_type === "glucose" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor={`fasting-max-${config.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Provider fasting reference ceiling ({unit})
                </Label>
                <Input
                  id={`fasting-max-${config.id}`}
                  type="number"
                  step="any"
                  min={1}
                  placeholder="Optional (leave blank unless prescribed)"
                  value={fastingMax}
                  onChange={(e) => setFastingMax(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor={`postmeal-max-${config.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Provider post-meal reference ceiling ({unit})
                </Label>
                <Input
                  id={`postmeal-max-${config.id}`}
                  type="number"
                  step="any"
                  min={1}
                  placeholder="Optional (leave blank unless prescribed)"
                  value={postMealMax}
                  onChange={(e) => setPostMealMax(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          ) : config.metric_type === "blood_pressure" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor={`sys-max-${config.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Provider systolic reference ceiling (mmHg)
                </Label>
                <Input
                  id={`sys-max-${config.id}`}
                  type="number"
                  min={40}
                  max={300}
                  placeholder="Optional"
                  value={systolicMax}
                  onChange={(e) => setSystolicMax(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor={`dia-max-${config.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Provider diastolic reference ceiling (mmHg)
                </Label>
                <Input
                  id={`dia-max-${config.id}`}
                  type="number"
                  min={20}
                  max={200}
                  placeholder="Optional"
                  value={diastolicMax}
                  onChange={(e) => setDiastolicMax(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          ) : null}
          <Textarea
            id={`targets-${config.id}`}
            value={targetNote}
            onChange={(e) => setTargetNote(e.target.value)}
            placeholder="Only enter reference targets or instructions given by your healthcare provider."
            rows={2}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {config.metric_type === "custom" && onDelete ? (
            <Button
              size="lg"
              variant="destructive"
              type="button"
              disabled={isDeleting || isSaving}
              onClick={() => onDelete(config.id)}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Delete Metric
            </Button>
          ) : (
            <div />
          )}

          <Button
            size="lg"
            type="button"
            disabled={isSaving || isDeleting}
            onClick={handleSubmit}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden="true" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
