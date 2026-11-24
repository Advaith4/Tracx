"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Loader2,
  Mail,
  Plus,
  Trash2,
} from "lucide-react";
import { BloodPressureChart } from "@/components/charts/blood-pressure-chart";
import { CustomMetricChart } from "@/components/charts/custom-metric-chart";
import { GlucoseChart } from "@/components/charts/glucose-chart";
import { WeightChart } from "@/components/charts/weight-chart";
import { EmptyState, ErrorState } from "@/components/layout/feedback-states";
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
import { Switch } from "@/components/ui/switch";
import { formatReportTimestamp } from "@/features/measurements/components/datetime-utils";
import type { ParsedWeeklyReport } from "@/features/weekly-reports/service";

interface ReportsWorkspaceProps {
  userId: string;
  timezone: string;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  initialReports: ParsedWeeklyReport[];
}

export function ReportsWorkspace({
  userId,
  timezone,
  defaultPeriodStart,
  defaultPeriodEnd,
  initialReports,
}: ReportsWorkspaceProps) {
  const queryClient = useQueryClient();
  const queryKey = ["reports", userId];

  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);
  const [sendEmailOnGenerate, setSendEmailOnGenerate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialReports[0]?.id ?? null
  );
  const [emailingId, setEmailingId] = useState<string | null>(null);

  const {
    data: reports = initialReports,
    error,
    refetch,
  } = useQuery<ParsedWeeklyReport[]>({
    queryKey,
    initialData: initialReports,
    queryFn: async () => {
      const res = await fetch("/api/reports");
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't load reports.");
      }
      return json.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          sendEmail: sendEmailOnGenerate,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't generate report.");
      }
      return json.data as {
        report: ParsedWeeklyReport;
        usedAi: boolean;
        emailResult: { sent: boolean; error?: string } | null;
      };
    },
    onSuccess: (data) => {
      setSelectedId(data.report.id);
      void queryClient.invalidateQueries({ queryKey });
      if (data.emailResult && !data.emailResult.sent) {
        toast.warning("Weekly report generated", {
          description:
            data.emailResult.error ?? "Report saved, but email wasn't sent.",
        });
      } else if (data.emailResult?.sent) {
        toast.success("Weekly report generated and emailed");
      } else {
        toast.success("Weekly report generated");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't delete report.");
      }
      return id;
    },
    onSuccess: (deletedId) => {
      void queryClient.invalidateQueries({ queryKey });
      if (selectedId === deletedId) {
        setSelectedId(null);
      }
      toast.success("Report deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  async function handleEmailReport(id: string) {
    setEmailingId(id);
    try {
      const res = await fetch(`/api/reports/${id}/email`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't send email.");
        return;
      }
      toast.success(`Report emailed to ${json.data.to}`);
    } catch {
      toast.error("Couldn't email report. Check your connection.");
    } finally {
      setEmailingId(null);
    }
  }

  const activeReport =
    reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  if (error) {
    return (
      <ErrorState
        message="Couldn't load your weekly reports."
        onRetry={() => void refetch()}
      />
    );
  }

  const glucoseContextsWithData = activeReport
    ? activeReport.statistics.glucose.contexts.filter((c) => c.stats.count > 0)
    : [];

  const hasGlucoseChart = Boolean(
    activeReport?.statistics.glucose.points &&
      activeReport.statistics.glucose.points.length > 0
  );
  const hasBpChart = Boolean(
    activeReport?.statistics.bloodPressure.points &&
      activeReport.statistics.bloodPressure.points.length > 0
  );
  const hasWeightChart = Boolean(
    activeReport?.statistics.weight.points &&
      activeReport.statistics.weight.points.length > 0
  );
  const firstCustomSeriesWithPoints =
    activeReport?.statistics.customMetrics?.find((m) => m.points.length > 0) ??
    null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <div className="flex flex-col gap-5 lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rep-start">Start</Label>
                <Input
                  id="rep-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rep-end">End</Label>
                <Input
                  id="rep-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl bg-muted/45 px-3.5 py-2.5 text-xs font-medium">
              <span>Email copy to me</span>
              <Switch
                checked={sendEmailOnGenerate}
                onCheckedChange={setSendEmailOnGenerate}
              />
            </label>

            <Button
              size="lg"
              type="button"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {reports.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Saved Reports ({reports.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {reports.map((rep) => {
                const selected = activeReport?.id === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedId(rep.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                      selected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/35 text-foreground hover:bg-muted/65"
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs font-semibold tabular-nums">
                        {rep.periodStart} → {rep.periodEnd}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {rep.statistics.overview.totalRecorded} recorded ·{" "}
                        {formatReportTimestamp(rep.generatedAt, timezone, false)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="lg:col-span-8">
        {reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No weekly reports yet"
            description="Generate your first weekly summary on the left to review tables, charts, and download a PDF."
          />
        ) : activeReport ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="tabular-nums">
                    Weekly Report: {activeReport.periodStart} to{" "}
                    {activeReport.periodEnd}
                  </CardTitle>
                  <CardDescription>
                    Generated{" "}
                    {formatReportTimestamp(
                      activeReport.generatedAt,
                      timezone,
                      true
                    )}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a href={`/api/reports/${activeReport.id}/pdf`} download>
                    <Button size="sm" variant="secondary" type="button">
                      <Download className="size-3.5" aria-hidden="true" />
                      Download PDF
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={emailingId === activeReport.id}
                    onClick={() => void handleEmailReport(activeReport.id)}
                  >
                    {emailingId === activeReport.id ? (
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Mail className="size-3.5" aria-hidden="true" />
                    )}
                    Email
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    aria-label="Delete report"
                    onClick={() => deleteMutation.mutate(activeReport.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 text-sm">
              {/* Executive Overview KPIs */}
              <div className="flex flex-col gap-3">
                <p className="leading-relaxed text-foreground">
                  {activeReport.narrative.summaryParagraph}
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-muted/45 p-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Adherence
                    </span>
                    <span className="text-xl font-semibold tabular-nums">
                      {activeReport.statistics.overview.completionPercent !==
                      null
                        ? `${activeReport.statistics.overview.completionPercent}%`
                        : "--"}
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/45 p-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recorded
                    </span>
                    <span className="text-xl font-semibold tabular-nums">
                      {activeReport.statistics.overview.totalRecorded}
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/45 p-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Skipped
                    </span>
                    <span className="text-xl font-semibold tabular-nums">
                      {activeReport.statistics.overview.totalSkipped}
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/45 p-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Missing
                    </span>
                    <span className="text-xl font-semibold tabular-nums">
                      {activeReport.statistics.overview.missingCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Table 1: Blood Glucose by Meal Context */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Blood Glucose Summary ({activeReport.statistics.glucose.unit})
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {activeReport.statistics.glucose.totalCount} total readings
                  </span>
                </div>

                {glucoseContextsWithData.length === 0 ? (
                  <p className="rounded-xl bg-muted/35 px-3.5 py-3 text-xs text-muted-foreground">
                    No blood glucose readings recorded in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl bg-muted/25">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-muted/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="px-3.5 py-2.5">Meal Context</th>
                          <th className="px-3.5 py-2.5 text-right">Readings</th>
                          <th className="px-3.5 py-2.5 text-right">Average</th>
                          <th className="px-3.5 py-2.5 text-right">
                            Range (Min–Max)
                          </th>
                          <th className="px-3.5 py-2.5 text-right">Latest</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {glucoseContextsWithData.map((ctx) => (
                          <tr key={ctx.key} className="hover:bg-muted/40">
                            <td className="px-3.5 py-2.5 font-medium text-foreground">
                              {ctx.label}
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                              {ctx.stats.count}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-semibold text-foreground tabular-nums">
                              {ctx.stats.average}{" "}
                              {activeReport.statistics.glucose.unit}
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                              {ctx.stats.min}–{ctx.stats.max}{" "}
                              {activeReport.statistics.glucose.unit}
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-foreground tabular-nums">
                              {ctx.stats.latest}{" "}
                              {activeReport.statistics.glucose.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Table 2: Vitals & Custom Metrics Summary */}
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Vitals &amp; Custom Metrics Summary
                </h3>
                <div className="overflow-x-auto rounded-xl bg-muted/25">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-muted/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-3.5 py-2.5">Metric</th>
                        <th className="px-3.5 py-2.5 text-right">Readings</th>
                        <th className="px-3.5 py-2.5 text-right">Average</th>
                        <th className="px-3.5 py-2.5 text-right">
                          Range / Change
                        </th>
                        <th className="px-3.5 py-2.5 text-right">Latest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      <tr className="hover:bg-muted/40">
                        <td className="px-3.5 py-2.5 font-medium text-foreground">
                          Blood Pressure
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                          {activeReport.statistics.bloodPressure.count}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-foreground tabular-nums">
                          {activeReport.statistics.bloodPressure.count > 0
                            ? `${activeReport.statistics.bloodPressure.systolic.average}/${activeReport.statistics.bloodPressure.diastolic.average} mmHg`
                            : "--"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                          {activeReport.statistics.bloodPressure.count > 0
                            ? `${activeReport.statistics.bloodPressure.systolic.min}–${activeReport.statistics.bloodPressure.systolic.max} / ${activeReport.statistics.bloodPressure.diastolic.min}–${activeReport.statistics.bloodPressure.diastolic.max}`
                            : "--"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-foreground tabular-nums">
                          {activeReport.statistics.bloodPressure.systolic
                            .latest !== null
                            ? `${activeReport.statistics.bloodPressure.systolic.latest}/${activeReport.statistics.bloodPressure.diastolic.latest} mmHg`
                            : "--"}
                        </td>
                      </tr>

                      {activeReport.statistics.bloodPressure.pulse.count > 0 ? (
                        <tr className="hover:bg-muted/40">
                          <td className="px-3.5 py-2.5 font-medium text-foreground">
                            Pulse (from BP)
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                            {activeReport.statistics.bloodPressure.pulse.count}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-semibold text-foreground tabular-nums">
                            {activeReport.statistics.bloodPressure.pulse.average}{" "}
                            bpm
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                            {activeReport.statistics.bloodPressure.pulse.min}–
                            {activeReport.statistics.bloodPressure.pulse.max} bpm
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-foreground tabular-nums">
                            {activeReport.statistics.bloodPressure.pulse.latest}{" "}
                            bpm
                          </td>
                        </tr>
                      ) : null}

                      <tr className="hover:bg-muted/40">
                        <td className="px-3.5 py-2.5 font-medium text-foreground">
                          Weight
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                          {activeReport.statistics.weight.stats.count}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-foreground tabular-nums">
                          {activeReport.statistics.weight.stats.average !== null
                            ? `${activeReport.statistics.weight.stats.average} ${activeReport.statistics.weight.unit}`
                            : "--"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                          {activeReport.statistics.weight.stats.change !== null
                            ? `${activeReport.statistics.weight.stats.change > 0 ? "+" : ""}${activeReport.statistics.weight.stats.change} ${activeReport.statistics.weight.unit}`
                            : "--"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-foreground tabular-nums">
                          {activeReport.statistics.weight.stats.latest !== null
                            ? `${activeReport.statistics.weight.stats.latest} ${activeReport.statistics.weight.unit}`
                            : "--"}
                        </td>
                      </tr>

                      {activeReport.statistics.customMetrics?.map((custom) => (
                        <tr key={custom.configId} className="hover:bg-muted/40">
                          <td className="px-3.5 py-2.5 font-medium text-foreground">
                            {custom.label}
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                            {custom.totalCount}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-semibold text-foreground tabular-nums">
                            {custom.stats.average !== null
                              ? `${custom.stats.average} ${custom.unit}`
                              : "--"}
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground tabular-nums">
                            {custom.stats.min !== null &&
                            custom.stats.max !== null
                              ? `${custom.stats.min}–${custom.stats.max} ${custom.unit}`
                              : "--"}
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-foreground tabular-nums">
                            {custom.stats.latest !== null
                              ? `${custom.stats.latest} ${custom.unit}`
                              : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Visualizations (up to 3 charts) */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Visual Trends
                </h3>

                {!hasGlucoseChart && !hasBpChart && !hasWeightChart ? (
                  <p className="rounded-xl bg-muted/35 px-3.5 py-3 text-xs text-muted-foreground">
                    Generate a fresh report to embed interactive trend charts for
                    your recorded readings.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {hasGlucoseChart &&
                    activeReport.statistics.glucose.points ? (
                      <div className="rounded-2xl bg-muted/30 p-4">
                        <p className="mb-2 text-xs font-semibold text-foreground">
                          Blood Glucose ({activeReport.statistics.glucose.unit})
                        </p>
                        <GlucoseChart
                          points={activeReport.statistics.glucose.points}
                          unit={activeReport.statistics.glucose.unit}
                          filter="all"
                        />
                      </div>
                    ) : null}

                    {hasBpChart &&
                    activeReport.statistics.bloodPressure.points ? (
                      <div className="rounded-2xl bg-muted/30 p-4">
                        <p className="mb-2 text-xs font-semibold text-foreground">
                          Blood Pressure (mmHg)
                        </p>
                        <BloodPressureChart
                          points={activeReport.statistics.bloodPressure.points}
                        />
                      </div>
                    ) : null}

                    {hasWeightChart && activeReport.statistics.weight.points ? (
                      <div className="rounded-2xl bg-muted/30 p-4">
                        <p className="mb-2 text-xs font-semibold text-foreground">
                          Weight ({activeReport.statistics.weight.unit})
                        </p>
                        <WeightChart
                          points={activeReport.statistics.weight.points}
                          unit={activeReport.statistics.weight.unit}
                        />
                      </div>
                    ) : firstCustomSeriesWithPoints ? (
                      <div className="rounded-2xl bg-muted/30 p-4">
                        <p className="mb-2 text-xs font-semibold text-foreground">
                          {firstCustomSeriesWithPoints.label} (
                          {firstCustomSeriesWithPoints.unit})
                        </p>
                        <CustomMetricChart
                          label={firstCustomSeriesWithPoints.label}
                          unit={firstCustomSeriesWithPoints.unit}
                          points={firstCustomSeriesWithPoints.points}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              {/* Observations & Provider Questions */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/35 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                    Descriptive Observations
                  </h3>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                    {activeReport.narrative.observations.map((obs, idx) => (
                      <li key={idx}>{obs}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-muted/35 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                    Questions for Your Provider
                  </h3>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                    {activeReport.narrative.providerQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Daily Notes Table */}
              {activeReport.statistics.notes.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Daily Notes
                  </h3>
                  <div className="overflow-x-auto rounded-xl bg-muted/25">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-muted/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="w-28 px-3.5 py-2.5">Date</th>
                          <th className="px-3.5 py-2.5">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {activeReport.statistics.notes.map((n) => (
                          <tr key={n.noteDate} className="hover:bg-muted/40">
                            <td className="px-3.5 py-2.5 font-medium text-foreground tabular-nums">
                              {n.noteDate}
                            </td>
                            <td className="px-3.5 py-2.5 text-muted-foreground">
                              {n.content}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {/* Data Limitations */}
              <div className="rounded-xl bg-muted/45 p-3.5 text-[11px] leading-relaxed text-muted-foreground">
                {activeReport.statistics.dataLimitations.map((lim, idx) => (
                  <p key={idx}>{lim}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
