"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Droplets,
  History,
  Mic,
  Pencil,
  PencilLine,
  Scale,
  Search,
  Trash2,
} from "lucide-react";
import { BloodPressureChart } from "@/components/charts/blood-pressure-chart";
import { GlucoseChart } from "@/components/charts/glucose-chart";
import { WeightChart } from "@/components/charts/weight-chart";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InsightsPayload } from "@/features/insights/service";
import { BloodPressureForm } from "@/features/measurements/components/blood-pressure-form";
import { CustomMetricForm } from "@/features/measurements/components/custom-metric-form";
import { GlucoseForm } from "@/features/measurements/components/glucose-form";
import { WeightForm } from "@/features/measurements/components/weight-form";
import type { UnifiedMeasurement } from "@/features/measurements/service";
import type {
  DateRangePreset,
  GlucoseContextFilter,
  NumericStats,
} from "@/lib/calculations/analytics";
import type { MetricType } from "@/types/database";

type InsightTab = "glucose" | "blood_pressure" | "weight" | "history";

interface InsightsWorkspaceProps {
  userId: string;
  initialData: InsightsPayload;
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {sublabel ? (
          <span className="text-[11px] text-muted-foreground">{sublabel}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ContextBreakdownCard({
  title,
  stats,
  unit,
}: {
  title: string;
  stats: NumericStats;
  unit: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        <span className="text-lg font-semibold text-foreground">
          {stats.average !== null ? `${stats.average} ${unit}` : "--"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {stats.count > 0
            ? `${stats.count} readings · ${stats.min}–${stats.max} ${unit}`
            : "No readings"}
        </span>
      </CardContent>
    </Card>
  );
}

function getDeleteEndpoint(item: UnifiedMeasurement): string {
  switch (item.metricType) {
    case "glucose":
      return `/api/measurements/glucose/${item.id}`;
    case "blood_pressure":
      return `/api/measurements/blood-pressure/${item.id}`;
    case "weight":
      return `/api/measurements/weight/${item.id}`;
    case "custom":
      return `/api/measurements/custom/${item.id}`;
  }
}

export function InsightsWorkspace({
  userId,
  initialData,
}: InsightsWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<InsightTab>("glucose");
  const [preset, setPreset] = useState<DateRangePreset>(initialData.preset);
  const [customStart, setCustomStart] = useState(initialData.startDate);
  const [customEnd, setCustomEnd] = useState(initialData.endDate);
  const [glucoseFilter, setGlucoseFilter] = useState<GlucoseContextFilter>(
    initialData.glucoseContext
  );
  const [historyMetric, setHistoryMetric] = useState<MetricType | "all">("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<UnifiedMeasurement | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<UnifiedMeasurement | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const queryKey = [
    "insights",
    userId,
    preset,
    customStart,
    customEnd,
    glucoseFilter,
    historyMetric,
    search,
  ];

  const isInitialParams =
    preset === initialData.preset &&
    customStart === initialData.startDate &&
    customEnd === initialData.endDate &&
    glucoseFilter === initialData.glucoseContext &&
    historyMetric === "all" &&
    search === "";

  const { data, isLoading, error, refetch } = useQuery<InsightsPayload>({
    queryKey,
    initialData: isInitialParams ? initialData : undefined,
    queryFn: async () => {
      const params = new URLSearchParams({
        range: preset,
        glucoseContext: glucoseFilter,
        metric: historyMetric,
      });
      if (preset === "custom") {
        params.set("start", customStart);
        params.set("end", customEnd);
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/insights?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't load insights.");
      }
      return json.data;
    },
  });

  function refreshAll() {
    setEditingItem(null);
    void queryClient.invalidateQueries({ queryKey: ["insights", userId] });
    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const response = await fetch(getDeleteEndpoint(deletingItem), {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't delete record.");
        return;
      }
      setDeletingItem(null);
      toast.success("Measurement deleted");
      refreshAll();
    } catch {
      toast.error("Couldn't delete record. Check your connection.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Date range selector */}
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Date Range
            </span>
            {data ? (
              <span className="text-xs text-muted-foreground">
                {data.startDate} to {data.endDate}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "7d", label: "Last 7 days" },
                { value: "14d", label: "Last 14 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "custom", label: "Custom" },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={preset === opt.value ? "default" : "outline"}
                type="button"
                onClick={() => setPreset(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="range-start">
                  From
                </label>
                <Input
                  id="range-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="range-end">
                  To
                </label>
                <Input
                  id="range-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Insights sections"
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        {(
          [
            { id: "glucose", label: "Glucose", icon: Droplets },
            { id: "blood_pressure", label: "Blood Pressure", icon: Activity },
            { id: "weight", label: "Weight", icon: Scale },
            { id: "history", label: "History", icon: History },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              role="tab"
              aria-selected={active}
              size="lg"
              variant={active ? "default" : "outline"}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="justify-center"
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {isLoading && !data ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState
          message="Couldn't load your historical insights."
          onRetry={() => void refetch()}
        />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">
                {data.completion.recordedCount}
              </strong>{" "}
              measurements recorded ·{" "}
              <strong className="text-foreground">
                {data.completion.skippedCount}
              </strong>{" "}
              skipped
            </span>
            {data.completion.completionPercent !== null ? (
              <span>
                Scheduled slots: {data.completion.scheduledSlots} (
                {data.completion.completionPercent}%)
              </span>
            ) : null}
          </div>

          {activeTab === "glucose" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "all", label: "All (context-separated)" },
                    { id: "fasting", label: "Fasting" },
                    { id: "before_meals", label: "Before meals" },
                    { id: "after_meals", label: "After meals" },
                    { id: "breakfast", label: "Breakfast" },
                    { id: "lunch", label: "Lunch" },
                    { id: "dinner", label: "Dinner" },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setGlucoseFilter(chip.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      glucoseFilter === chip.id
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {glucoseFilter === "all" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ContextBreakdownCard
                    title="Fasting Average"
                    stats={data.glucose.breakdowns.fasting}
                    unit={data.glucose.unit}
                  />
                  <ContextBreakdownCard
                    title="Before Meals Average"
                    stats={data.glucose.breakdowns.beforeMeals}
                    unit={data.glucose.unit}
                  />
                  <ContextBreakdownCard
                    title="After Meals Average"
                    stats={data.glucose.breakdowns.afterMeals}
                    unit={data.glucose.unit}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard
                    label="Readings"
                    value={String(data.glucose.filteredStats?.count ?? 0)}
                  />
                  <StatCard
                    label="Average"
                    value={
                      data.glucose.filteredStats?.average !== null &&
                      data.glucose.filteredStats?.average !== undefined
                        ? `${data.glucose.filteredStats.average} ${data.glucose.unit}`
                        : "--"
                    }
                  />
                  <StatCard
                    label="Minimum"
                    value={
                      data.glucose.filteredStats?.min !== null &&
                      data.glucose.filteredStats?.min !== undefined
                        ? `${data.glucose.filteredStats.min} ${data.glucose.unit}`
                        : "--"
                    }
                  />
                  <StatCard
                    label="Maximum"
                    value={
                      data.glucose.filteredStats?.max !== null &&
                      data.glucose.filteredStats?.max !== undefined
                        ? `${data.glucose.filteredStats.max} ${data.glucose.unit}`
                        : "--"
                    }
                  />
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Blood Glucose Trend</CardTitle>
                  <CardDescription>
                    Fasting, before-meal, and after-meal readings are kept
                    separate so contexts are never mixed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GlucoseChart
                    points={data.glucose.points}
                    unit={data.glucose.unit}
                    filter={glucoseFilter}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "blood_pressure" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Readings"
                  value={String(data.bloodPressure.count)}
                />
                <StatCard
                  label="Avg Systolic"
                  value={
                    data.bloodPressure.systolic.average !== null
                      ? `${data.bloodPressure.systolic.average} mmHg`
                      : "--"
                  }
                />
                <StatCard
                  label="Avg Diastolic"
                  value={
                    data.bloodPressure.diastolic.average !== null
                      ? `${data.bloodPressure.diastolic.average} mmHg`
                      : "--"
                  }
                />
                <StatCard
                  label="Avg Pulse"
                  value={
                    data.bloodPressure.pulse.average !== null
                      ? `${data.bloodPressure.pulse.average} bpm`
                      : "--"
                  }
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Blood Pressure Trend</CardTitle>
                  <CardDescription>
                    Systolic and diastolic readings plotted chronologically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BloodPressureChart points={data.bloodPressure.points} />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "weight" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Records"
                  value={String(data.weight.stats.count)}
                />
                <StatCard
                  label="Latest"
                  value={
                    data.weight.stats.latest !== null
                      ? `${data.weight.stats.latest} ${data.weight.unit}`
                      : "--"
                  }
                />
                <StatCard
                  label="Range"
                  value={
                    data.weight.stats.min !== null &&
                    data.weight.stats.max !== null
                      ? `${data.weight.stats.min}–${data.weight.stats.max} ${data.weight.unit}`
                      : "--"
                  }
                />
                <StatCard
                  label="Period Change"
                  value={
                    data.weight.stats.change !== null
                      ? `${data.weight.stats.change > 0 ? "+" : ""}${data.weight.stats.change} ${data.weight.unit}`
                      : "--"
                  }
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Weight Trend</CardTitle>
                  <CardDescription>
                    Chronological weight history in {data.weight.unit}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WeightChart
                    points={data.weight.points}
                    unit={data.weight.unit}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "history" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="relative sm:col-span-2">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search notes, context, or values..."
                    aria-label="Search history"
                    className="h-11 pl-9"
                  />
                </div>

                <Select
                  value={historyMetric}
                  onValueChange={(next) => {
                    if (next) setHistoryMetric(next as MetricType | "all");
                  }}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="All metrics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All metrics</SelectItem>
                    <SelectItem value="glucose">Blood Glucose</SelectItem>
                    <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                    <SelectItem value="weight">Weight</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.history.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No matching records"
                  description="Try widening the date range or clearing your search filters."
                />
              ) : (
                <Card size="sm">
                  <CardContent className="divide-y divide-border p-0">
                    {data.history.map((item) => (
                      <div
                        key={`${item.metricType}-${item.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {item.displayValue}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {item.metricLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              {item.source === "voice" ? (
                                <Mic className="size-3" aria-hidden="true" />
                              ) : (
                                <PencilLine
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="capitalize">{item.source}</span>
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.contextLabel} · {item.measuredAtLabel}
                          </span>
                          {item.notes ? (
                            <span className="truncate text-xs italic text-muted-foreground">
                              &ldquo;{item.notes}&rdquo;
                            </span>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            aria-label={`Edit ${item.metricLabel}`}
                            onClick={() => setEditingItem(item)}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            aria-label={`Delete ${item.metricLabel}`}
                            onClick={() => setDeletingItem(item)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editingItem?.metricLabel}</DialogTitle>
            <DialogDescription>
              Update the recorded value, context, timestamp, or notes.
            </DialogDescription>
          </DialogHeader>

          {editingItem?.rawGlucose ? (
            <GlucoseForm
              initialRecord={editingItem.rawGlucose}
              onSaved={refreshAll}
            />
          ) : editingItem?.rawBloodPressure ? (
            <BloodPressureForm
              initialRecord={editingItem.rawBloodPressure}
              onSaved={refreshAll}
            />
          ) : editingItem?.rawWeight ? (
            <WeightForm
              initialRecord={editingItem.rawWeight}
              onSaved={refreshAll}
            />
          ) : editingItem?.rawCustom && data ? (
            <CustomMetricForm
              customConfigs={data.configs.filter(
                (c) => c.metric_type === "custom"
              )}
              initialRecord={editingItem.rawCustom}
              onSaved={refreshAll}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Measurement</DialogTitle>
            <DialogDescription>
              Remove {deletingItem?.metricLabel} ({deletingItem?.displayValue})
              recorded on {deletingItem?.measuredAtLabel}? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDeletingItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
