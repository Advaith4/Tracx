"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Droplets,
  FileText,
  Flame,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Table2,
} from "lucide-react";
import { BloodPressureChart } from "@/components/charts/blood-pressure-chart";
import { CustomMetricChart } from "@/components/charts/custom-metric-chart";
import { GlucoseChart } from "@/components/charts/glucose-chart";
import { GlucoseMealBarChart } from "@/components/charts/glucose-meal-bar-chart";
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
import { Input } from "@/components/ui/input";
import type { InsightsPayload } from "@/features/insights/service";
import { LogbookWorkspace } from "@/features/logbook/components/logbook-workspace";
import { ReportsWorkspace } from "@/features/weekly-reports/components/reports-workspace";
import type { ParsedWeeklyReport } from "@/features/weekly-reports/service";
import type {
  DateRangePreset,
  GlucoseContextFilter,
} from "@/lib/calculations/analytics";
import { cn } from "@/lib/utils";

export type InsightTab =
  | "overview"
  | "sheet"
  | "glucose"
  | "blood_pressure"
  | "weight"
  | "custom"
  | "reports";

interface InsightsWorkspaceProps {
  userId: string;
  initialData: InsightsPayload;
  initialTab?: InsightTab;
  reportsSeed: {
    timezone: string;
    defaultPeriodStart: string;
    defaultPeriodEnd: string;
    initialReports: ParsedWeeklyReport[];
  };
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
        <span className="truncate text-xs text-muted-foreground">
          {sublabel}
        </span>
      </CardContent>
    </Card>
  );
}

export function InsightsWorkspace({
  userId,
  initialData,
  initialTab = "overview",
  reportsSeed,
}: InsightsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<InsightTab>(initialTab);
  const [preset, setPreset] = useState<DateRangePreset>(initialData.preset);
  const [customStart, setCustomStart] = useState(initialData.startDate);
  const [customEnd, setCustomEnd] = useState(initialData.endDate);
  const [glucoseFilter, setGlucoseFilter] = useState<GlucoseContextFilter>(
    initialData.glucoseContext
  );
  const [selectedCustomId, setSelectedCustomId] = useState<string>(
    initialData.customMetrics[0]?.configId ?? ""
  );

  const queryKey = [
    "insights",
    userId,
    preset,
    customStart,
    customEnd,
    glucoseFilter,
  ];

  const isInitialParams =
    preset === initialData.preset &&
    customStart === initialData.startDate &&
    customEnd === initialData.endDate &&
    glucoseFilter === initialData.glucoseContext;

  const { data, isLoading, error, refetch } = useQuery<InsightsPayload>({
    queryKey,
    initialData: isInitialParams ? initialData : undefined,
    queryFn: async () => {
      const params = new URLSearchParams({
        range: preset,
        glucoseContext: glucoseFilter,
      });
      if (preset === "custom") {
        params.set("start", customStart);
        params.set("end", customEnd);
      }

      const response = await fetch(`/api/insights?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't load insights.");
      }
      return json.data;
    },
  });

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

  const showCustomTab = (data?.customMetrics.length ?? 0) > 0;
  const isStandaloneSubTab = activeTab === "sheet" || activeTab === "reports";

  return (
    <div className="flex flex-col gap-5">
      {/* Unified navigation + date range controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Insights sections"
            className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 sm:flex-wrap"
          >
            {(
              [
                { id: "overview", label: "Overview", icon: Sparkles },
                { id: "sheet", label: "Excel Sheet", icon: Table2 },
                { id: "glucose", label: "Glucose", icon: Droplets },
                {
                  id: "blood_pressure",
                  label: "Blood Pressure",
                  icon: Activity,
                },
                { id: "weight", label: "Weight", icon: Scale },
                ...(showCustomTab
                  ? [
                      {
                        id: "custom" as const,
                        label: "Custom",
                        icon: SlidersHorizontal,
                      },
                    ]
                  : []),
                { id: "reports", label: "Reports", icon: FileText },
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
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all",
                    active
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === "sheet" ? (
            <Link
              href="/logbook"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Full-Screen Sheet &rarr;
            </Link>
          ) : !isStandaloneSubTab ? (
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
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                      preset === opt.value
                        ? "bg-card text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
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
          ) : null}
        </div>

        {!isStandaloneSubTab && preset === "custom" ? (
          <Card size="sm">
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="range-start"
                >
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
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="range-end"
                >
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
          {/* OVERVIEW TAB: Actionable synthesis & patterns */}
          {activeTab === "overview" ? (
            <div className="flex flex-col gap-5">
              {/* Overview KPIs */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricKpiTile
                  label="Tracking Streak"
                  value={`${data.synthesis.currentStreakDays}d`}
                  sublabel="Consecutive active days"
                />
                <MetricKpiTile
                  label="Adherence"
                  value={adherenceValue}
                  sublabel={adherenceSublabel}
                />
                <MetricKpiTile
                  label="Fasting Avg"
                  value={
                    data.glucose.breakdowns.fasting.average !== null
                      ? `${data.glucose.breakdowns.fasting.average} ${data.glucose.unit}`
                      : "--"
                  }
                  sublabel={`${data.glucose.breakdowns.fasting.count} fasting readings`}
                />
                <MetricKpiTile
                  label="Blood Pressure"
                  value={
                    data.bloodPressure.systolic.average !== null &&
                    data.bloodPressure.diastolic.average !== null
                      ? `${data.bloodPressure.systolic.average}/${data.bloodPressure.diastolic.average}`
                      : "--"
                  }
                  sublabel={
                    data.bloodPressure.count > 0
                      ? `${data.bloodPressure.count} readings (mmHg)`
                      : "No BP logged in range"
                  }
                />
              </div>

              {/* Actionable Takeaways */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    What Your Data Shows
                  </h2>
                  {data.synthesis.profileContext.pregnancyWeek ? (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground tabular-nums">
                      Week {data.synthesis.profileContext.pregnancyWeek}
                    </span>
                  ) : null}
                </div>

                {data.synthesis.highlights.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title="Log a few days of readings to unlock patterns"
                    description="Once you record fasting, mealtime glucose, BP, or weight across several days, Tracx highlights meal differences, shifts, and check-in streaks here."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {data.synthesis.highlights.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            card.targetTab === "history"
                              ? "sheet"
                              : card.targetTab
                          )
                        }
                        className="group flex flex-col justify-between gap-2 rounded-2xl bg-card p-4 text-left shadow-2xs ring-1 ring-border/70 transition-all hover:ring-primary/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                              card.tone === "positive"
                                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                                : card.tone === "attention"
                                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                                  : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            {card.badge}
                          </span>
                          <ArrowRight
                            className="size-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-semibold text-foreground">
                            {card.title}
                          </h3>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {card.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Meal comparison + Routine Check-In Consistency */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>Meal-by-Meal Glucose</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GlucoseMealBarChart
                      buckets={data.synthesis.mealComparison}
                      unit={data.glucose.unit}
                    />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <Flame
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        Check-In Routine
                      </CardTitle>
                      <Link
                        href="/calendar"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Calendar &rarr;
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {data.synthesis.slotConsistency.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No scheduled check-in slots configured.
                      </p>
                    ) : (
                      data.synthesis.slotConsistency.map((slot) => (
                        <div key={slot.id} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">
                              {slot.metricLabel} · {slot.context}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {slot.loggedCount}/{slot.expectedCount} (
                              {slot.percent}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                slot.percent >= 80
                                  ? "bg-primary"
                                  : slot.percent >= 50
                                    ? "bg-amber-500"
                                    : "bg-muted-foreground/50"
                              )}
                              style={{ width: `${slot.percent}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Care Team Visit Prep */}
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      Care Team Summary
                    </CardTitle>
                    {data.synthesis.profileContext.providerName ? (
                      <CardDescription>
                        Prepared for {data.synthesis.profileContext.providerName}
                      </CardDescription>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => setActiveTab("reports")}
                      className="gap-1.5 rounded-lg"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      Weekly Reports &amp; PDF
                    </Button>
                    <Link
                      href="/profile/tracking"
                      className={cn(
                        buttonVariants({ size: "sm", variant: "secondary" }),
                        "gap-1.5 rounded-lg"
                      )}
                    >
                      <SlidersHorizontal
                        className="size-3.5"
                        aria-hidden="true"
                      />
                      Targets
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.synthesis.visitPrepBullets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Log readings to assemble your appointment summary.
                    </p>
                  ) : (
                    <ul className="space-y-2 rounded-xl bg-muted/40 p-3.5 text-xs leading-relaxed text-foreground">
                      {data.synthesis.visitPrepBullets.map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* GLUCOSE TAB */}
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
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle>Blood Glucose Trend</CardTitle>
                      <CardDescription>
                        Fasting, before-meal, and after-meal contexts stay
                        strictly separated.
                      </CardDescription>
                    </div>
                    {!data.synthesis.providerTargets.glucose?.fastingMax &&
                    !data.synthesis.providerTargets.glucose?.postMealMax ? (
                      <Link
                        href="/profile/tracking"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        + Add doctor&apos;s reference range
                      </Link>
                    ) : null}
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
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          glucoseFilter === chip.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
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
                    fastingMax={
                      data.synthesis.providerTargets.glucose?.fastingMax
                    }
                    postMealMax={
                      data.synthesis.providerTargets.glucose?.postMealMax
                    }
                  />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>Average by Meal Timing</CardTitle>
                    <CardDescription>
                      Identify which specific meal time produces higher readings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GlucoseMealBarChart
                      buckets={data.synthesis.mealComparison}
                      unit={data.glucose.unit}
                    />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                  <CardHeader>
                    <CardTitle>Peak &amp; Lowest Context</CardTitle>
                    <CardDescription>
                      Readings paired with the meal or activity notes you saved.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {data.synthesis.glucoseCallouts.highest ? (
                      <div className="rounded-xl bg-muted/45 p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-muted-foreground">
                            {data.synthesis.glucoseCallouts.highest.label}
                          </span>
                          <span className="text-foreground tabular-nums">
                            {data.synthesis.glucoseCallouts.highest.value}
                          </span>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">
                          {data.synthesis.glucoseCallouts.highest.context} ·{" "}
                          {
                            data.synthesis.glucoseCallouts.highest
                              .measuredAtLabel
                          }
                        </p>
                        {data.synthesis.glucoseCallouts.highest.note ? (
                          <p className="mt-1.5 italic text-foreground/85">
                            &ldquo;{data.synthesis.glucoseCallouts.highest.note}
                            &rdquo;
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {data.synthesis.glucoseCallouts.lowest ? (
                      <div className="rounded-xl bg-muted/45 p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-muted-foreground">
                            {data.synthesis.glucoseCallouts.lowest.label}
                          </span>
                          <span className="text-foreground tabular-nums">
                            {data.synthesis.glucoseCallouts.lowest.value}
                          </span>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">
                          {data.synthesis.glucoseCallouts.lowest.context} ·{" "}
                          {
                            data.synthesis.glucoseCallouts.lowest
                              .measuredAtLabel
                          }
                        </p>
                        {data.synthesis.glucoseCallouts.lowest.note ? (
                          <p className="mt-1.5 italic text-foreground/85">
                            &ldquo;{data.synthesis.glucoseCallouts.lowest.note}
                            &rdquo;
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {!data.synthesis.glucoseCallouts.highest &&
                    !data.synthesis.glucoseCallouts.lowest ? (
                      <p className="text-xs text-muted-foreground">
                        No glucose readings in this range yet.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {/* BLOOD PRESSURE TAB */}
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
                  <BloodPressureChart
                    points={data.bloodPressure.points}
                    systolicMax={
                      data.synthesis.providerTargets.bloodPressure?.systolicMax
                    }
                    diastolicMax={
                      data.synthesis.providerTargets.bloodPressure?.diastolicMax
                    }
                  />
                </CardContent>
              </Card>

              {data.synthesis.bpCallouts.highest ||
              data.synthesis.bpCallouts.lowest ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    data.synthesis.bpCallouts.highest,
                    data.synthesis.bpCallouts.lowest,
                  ]
                    .filter(Boolean)
                    .map((callout) => (
                      <Card key={callout!.label} size="sm">
                        <CardContent className="flex flex-col gap-1 py-3 text-xs">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-muted-foreground">
                              {callout!.label}
                            </span>
                            <span className="text-sm text-foreground tabular-nums">
                              {callout!.value}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            {callout!.context} · {callout!.measuredAtLabel}
                          </span>
                          {callout!.note ? (
                            <span className="pt-1 italic text-foreground/85">
                              &ldquo;{callout!.note}&rdquo;
                            </span>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* WEIGHT TAB */}
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
                  label="Weekly Pace"
                  value={
                    data.synthesis.weightPacePerWeek !== null
                      ? `${data.synthesis.weightPacePerWeek > 0 ? "+" : ""}${data.synthesis.weightPacePerWeek} ${data.weight.unit}/wk`
                      : "--"
                  }
                  sublabel="Average rate of change"
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

          {/* CUSTOM METRICS TAB */}
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
                      className={buttonVariants({
                        size: "lg",
                        variant: "secondary",
                      })}
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
                              onClick={() =>
                                setSelectedCustomId(series.configId)
                              }
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                activeCustomSeries.configId === series.configId
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
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

          {/* EXCEL SHEET TAB */}
          {activeTab === "sheet" ? (
            <LogbookWorkspace userId={userId} />
          ) : null}

          {/* REPORTS TAB */}
          {activeTab === "reports" ? (
            <ReportsWorkspace
              userId={userId}
              timezone={reportsSeed.timezone}
              defaultPeriodStart={reportsSeed.defaultPeriodStart}
              defaultPeriodEnd={reportsSeed.defaultPeriodEnd}
              initialReports={reportsSeed.initialReports}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
