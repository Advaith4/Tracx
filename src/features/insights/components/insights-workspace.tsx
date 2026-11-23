"use client";

import { useState } from "react";
import Link from "next/link";
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
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { BloodPressureChart } from "@/components/charts/blood-pressure-chart";
import { CustomMetricChart } from "@/components/charts/custom-metric-chart";
import { GlucoseChart } from "@/components/charts/glucose-chart";
import { WeightChart } from "@/components/charts/weight-chart";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/feedback-states";
import { Button, buttonVariants } from "@/components/ui/button";
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
} from "@/lib/calculations/analytics";
import type { MetricType } from "@/types/database";

type InsightTab = "glucose" | "blood_pressure" | "weight" | "custom" | "history";

interface InsightsWorkspaceProps {
  userId: string;
  initialData: InsightsPayload;
}

function MetricKpiTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex h-full flex-col justify-between gap-1.5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums sm:text-2xl">
          {value}
        </span>
        <span className="truncate text-xs text-muted-foreground">{sublabel}</span>
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
  const [selectedCustomId, setSelectedCustomId] = useState<string>(
    initialData.customMetrics[0]?.configId ?? ""
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

  const activeCustomSeries =
    data?.customMetrics.find((c) => c.configId === selectedCustomId) ??
    data?.customMetrics[0] ??
    null;

  const adherenceValue =
    data?.completion.completionPercent !== null &&
    data?.completion.completionPercent !== undefined
      ? `${data.completion.completionPercent}%`
      : String(data?.completion.recordedCount ?? 0);

  const adherenceSublabel = data
    ? `${data.completion.recordedCount} logged · ${data.completion.skippedCount} skipped`
    : "Period adherence";

  return (
    <div className="flex flex-col gap-5">
      {/* Unified navigation + date range controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Insights sections"
            className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1"
          >
            {(
              [
                { id: "glucose", label: "Glucose", icon: Droplets },
                { id: "blood_pressure", label: "Blood Pressure", icon: Activity },
                { id: "weight", label: "Weight", icon: Scale },
                { id: "custom", label: "Custom", icon: SlidersHorizontal },
                { id: "history", label: "History", icon: History },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:flex-initial ${
                    active
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
              {(
                [
                  { value: "7d", label: "7D" },
                  { value: "14d", label: "14D" },
                  { value: "30d", label: "30D" },
                  { value: "custom", label: "Custom" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreset(opt.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    preset === opt.value
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {data ? (
              <span className="rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">
                {data.startDate} → {data.endDate}
              </span>
            ) : null}
          </div>
        </div>

        {preset === "custom" ? (
          <Card size="sm">
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="range-start">
                  Start date
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
                <label className="text-xs font-medium text-muted-foreground" htmlFor="range-end">
                  End date
                </label>
                <Input
                  id="range-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>
        ) : null}
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
          {activeTab === "glucose" ? (
            <div className="flex flex-col gap-4">
              {glucoseFilter === "all" ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricKpiTile
                    label="Fasting Avg"
                    value={
                      data.glucose.breakdowns.fasting.average !== null
                        ? `${data.glucose.breakdowns.fasting.average} ${data.glucose.unit}`
                        : "--"
                    }
                    sublabel={
                      data.glucose.breakdowns.fasting.count > 0
                        ? `${data.glucose.breakdowns.fasting.count} readings · ${data.glucose.breakdowns.fasting.min}–${data.glucose.breakdowns.fasting.max}`
                        : "No fasting readings"
                    }
                  />
                  <MetricKpiTile
                    label="Before Meals Avg"
                    value={
                      data.glucose.breakdowns.beforeMeals.average !== null
                        ? `${data.glucose.breakdowns.beforeMeals.average} ${data.glucose.unit}`
                        : "--"
                    }
                    sublabel={
                      data.glucose.breakdowns.beforeMeals.count > 0
                        ? `${data.glucose.breakdowns.beforeMeals.count} readings · ${data.glucose.breakdowns.beforeMeals.min}–${data.glucose.breakdowns.beforeMeals.max}`
                        : "No pre-meal readings"
                    }
                  />
                  <MetricKpiTile
                    label="After Meals Avg"
                    value={
                      data.glucose.breakdowns.afterMeals.average !== null
                        ? `${data.glucose.breakdowns.afterMeals.average} ${data.glucose.unit}`
                        : "--"
                    }
                    sublabel={
                      data.glucose.breakdowns.afterMeals.count > 0
                        ? `${data.glucose.breakdowns.afterMeals.count} readings · ${data.glucose.breakdowns.afterMeals.min}–${data.glucose.breakdowns.afterMeals.max}`
                        : "No post-meal readings"
                    }
                  />
                  <MetricKpiTile
                    label="Adherence"
                    value={adherenceValue}
                    sublabel={adherenceSublabel}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricKpiTile
                    label="Average"
                    value={
                      data.glucose.filteredStats?.average !== null &&
                      data.glucose.filteredStats?.average !== undefined
                        ? `${data.glucose.filteredStats.average} ${data.glucose.unit}`
                        : "--"
                    }
                    sublabel={`${data.glucose.filteredStats?.count ?? 0} matching readings`}
                  />
                  <MetricKpiTile
                    label="Range"
                    value={
                      data.glucose.filteredStats?.min !== null &&
                      data.glucose.filteredStats?.min !== undefined &&
                      data.glucose.filteredStats?.max !== null &&
                      data.glucose.filteredStats?.max !== undefined
                        ? `${data.glucose.filteredStats.min}–${data.glucose.filteredStats.max}`
                        : "--"
                    }
                    sublabel={data.glucose.unit}
                  />
                  <MetricKpiTile
                    label="Latest"
                    value={
                      data.glucose.filteredStats?.latest !== null &&
                      data.glucose.filteredStats?.latest !== undefined
                        ? `${data.glucose.filteredStats.latest} ${data.glucose.unit}`
                        : "--"
                    }
                    sublabel="Most recent in window"
                  />
                  <MetricKpiTile
                    label="Adherence"
                    value={adherenceValue}
                    sublabel={adherenceSublabel}
                  />
                </div>
              )}

              <Card>
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Blood Glucose Trend</CardTitle>
                      <CardDescription>
                        Fasting, before-meal, and after-meal contexts stay
                        strictly separated.
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: "all", label: "All contexts" },
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
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          glucoseFilter === chip.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricKpiTile
                  label="Avg Pressure"
                  value={
                    data.bloodPressure.systolic.average !== null &&
                    data.bloodPressure.diastolic.average !== null
                      ? `${data.bloodPressure.systolic.average}/${data.bloodPressure.diastolic.average}`
                      : "--"
                  }
                  sublabel="mmHg average"
                />
                <MetricKpiTile
                  label="Avg Pulse"
                  value={
                    data.bloodPressure.pulse.average !== null
                      ? `${data.bloodPressure.pulse.average} bpm`
                      : "--"
                  }
                  sublabel={
                    data.bloodPressure.pulse.count > 0
                      ? `${data.bloodPressure.pulse.count} with pulse`
                      : "Optional field"
                  }
                />
                <MetricKpiTile
                  label="Readings"
                  value={String(data.bloodPressure.count)}
                  sublabel={`${data.startDate} to ${data.endDate}`}
                />
                <MetricKpiTile
                  label="Adherence"
                  value={adherenceValue}
                  sublabel={adherenceSublabel}
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricKpiTile
                  label="Latest Weight"
                  value={
                    data.weight.stats.latest !== null
                      ? `${data.weight.stats.latest} ${data.weight.unit}`
                      : "--"
                  }
                  sublabel={`${data.weight.stats.count} check-ins`}
                />
                <MetricKpiTile
                  label="Period Change"
                  value={
                    data.weight.stats.change !== null
                      ? `${data.weight.stats.change > 0 ? "+" : ""}${data.weight.stats.change} ${data.weight.unit}`
                      : "--"
                  }
                  sublabel="First to latest in window"
                />
                <MetricKpiTile
                  label="Range"
                  value={
                    data.weight.stats.min !== null &&
                    data.weight.stats.max !== null
                      ? `${data.weight.stats.min}–${data.weight.stats.max}`
                      : "--"
                  }
                  sublabel={data.weight.unit}
                />
                <MetricKpiTile
                  label="Adherence"
                  value={adherenceValue}
                  sublabel={adherenceSublabel}
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

          {activeTab === "custom" ? (
            <div className="flex flex-col gap-4">
              {!activeCustomSeries ? (
                <EmptyState
                  icon={SlidersHorizontal}
                  title="No custom metrics configured yet"
                  description="Add custom measurements like Heart Rate, Body Temperature, or Hydration in Tracking Settings to view their trends here."
                  action={
                    <Link
                      href="/profile/tracking"
                      className={buttonVariants({ size: "lg", variant: "secondary" })}
                    >
                      Configure Custom Metrics
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <MetricKpiTile
                      label="Latest"
                      value={
                        activeCustomSeries.stats.latest !== null
                          ? `${activeCustomSeries.stats.latest} ${activeCustomSeries.unit}`
                          : "--"
                      }
                      sublabel={activeCustomSeries.label}
                    />
                    <MetricKpiTile
                      label="Average"
                      value={
                        activeCustomSeries.stats.average !== null
                          ? `${activeCustomSeries.stats.average} ${activeCustomSeries.unit}`
                          : "--"
                      }
                      sublabel={`${activeCustomSeries.stats.count} numeric entries`}
                    />
                    <MetricKpiTile
                      label="Range"
                      value={
                        activeCustomSeries.stats.min !== null &&
                        activeCustomSeries.stats.max !== null
                          ? `${activeCustomSeries.stats.min}–${activeCustomSeries.stats.max}`
                          : "--"
                      }
                      sublabel={activeCustomSeries.unit || "Observed range"}
                    />
                    <MetricKpiTile
                      label="Entries"
                      value={String(activeCustomSeries.totalCount)}
                      sublabel={
                        activeCustomSeries.textEntriesCount > 0
                          ? `${activeCustomSeries.textEntriesCount} text note(s)`
                          : `${data.startDate} to ${data.endDate}`
                      }
                    />
                  </div>

                  <Card>
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-1">
                        <CardTitle>{activeCustomSeries.label} Trend</CardTitle>
                        <CardDescription>
                          Chronological entries for your custom{" "}
                          {activeCustomSeries.label.toLowerCase()} metric.
                        </CardDescription>
                      </div>

                      {data.customMetrics.length > 1 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {data.customMetrics.map((series) => (
                            <button
                              key={series.configId}
                              type="button"
                              onClick={() => setSelectedCustomId(series.configId)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                activeCustomSeries.configId === series.configId
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              {series.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <CustomMetricChart
                        label={activeCustomSeries.label}
                        unit={activeCustomSeries.unit}
                        points={activeCustomSeries.points}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          ) : null}

          {activeTab === "history" ? (
            <Card>
              <CardHeader className="gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Measurement History</CardTitle>
                    <CardDescription>
                      Search, edit, or remove any reading recorded in this
                      window.
                    </CardDescription>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                    {data.history.length} entries
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
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
                      className="h-10 pl-9"
                    />
                  </div>

                  <Select
                    value={historyMetric}
                    onValueChange={(next) => {
                      if (next) setHistoryMetric(next as MetricType | "all");
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="All metrics">
                        {(value: string | null) =>
                          value === "glucose"
                            ? "Blood Glucose"
                            : value === "blood_pressure"
                              ? "Blood Pressure"
                              : value === "weight"
                                ? "Weight"
                                : value === "custom"
                                  ? "Custom"
                                  : "All metrics"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All metrics</SelectItem>
                      <SelectItem value="glucose">Blood Glucose</SelectItem>
                      <SelectItem value="blood_pressure">
                        Blood Pressure
                      </SelectItem>
                      <SelectItem value="weight">Weight</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                {data.history.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="No matching records"
                    description="Try widening the date range or clearing your search filters."
                  />
                ) : (
                  <div className="flex flex-col gap-1">
                    {data.history.map((item) => (
                      <div
                        key={`${item.metricType}-${item.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/45"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground tabular-nums">
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
                  </div>
                )}
              </CardContent>
            </Card>
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
