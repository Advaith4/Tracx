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
        toast.success("Weekly report generated", {
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <div className="flex flex-col gap-5 lg:col-span-4">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>
              Structured summary with deterministic statistics and neutral
              observations.
            </CardDescription>
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

            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/80 px-3.5 py-2.5 text-xs font-medium">
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
              <CardTitle className="text-sm">Saved Reports ({reports.length})</CardTitle>
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
            description="Generate your first weekly summary on the left to review your records and download a PDF."
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
                    {formatReportTimestamp(activeReport.generatedAt, timezone, true)}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/reports/${activeReport.id}/pdf`}
                    download
                  >
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
                    onClick={() => deleteMutation.mutate(activeReport.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-5 pt-5 text-sm">
              <p className="leading-relaxed text-foreground">
                {activeReport.narrative.summaryParagraph}
              </p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-muted/45 p-3">
                  <span className="block text-xs text-muted-foreground">
                    Scheduled
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {activeReport.statistics.overview.totalScheduled}
                  </span>
                </div>
                <div className="rounded-xl bg-muted/45 p-3">
                  <span className="block text-xs text-muted-foreground">
                    Recorded
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {activeReport.statistics.overview.totalRecorded}
                  </span>
                </div>
                <div className="rounded-xl bg-muted/45 p-3">
                  <span className="block text-xs text-muted-foreground">
                    Skipped
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {activeReport.statistics.overview.totalSkipped}
                  </span>
                </div>
                <div className="rounded-xl bg-muted/45 p-3">
                  <span className="block text-xs text-muted-foreground">
                    Missing
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {activeReport.statistics.overview.missingCount}
                  </span>
                </div>
              </div>

                {/* Blood Glucose context-separated */}
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-foreground">
                    Blood Glucose Summary ({activeReport.statistics.glucose.unit})
                  </h3>
                  {activeReport.statistics.glucose.totalCount === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No blood glucose readings recorded in this period.
                    </p>
                  ) : (
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {activeReport.statistics.glucose.contexts
                        .filter((ctx) => ctx.stats.count > 0)
                        .map((ctx) => (
                          <div
                            key={ctx.key}
                            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                          >
                            <span className="font-medium text-foreground">
                              {ctx.label} ({ctx.stats.count})
                            </span>
                            <span className="text-muted-foreground">
                              Avg {ctx.stats.average} · Range {ctx.stats.min}–
                              {ctx.stats.max} {activeReport.statistics.glucose.unit}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Blood Pressure & Weight */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border p-3.5">
                    <h3 className="mb-1 font-semibold text-foreground">
                      Blood Pressure
                    </h3>
                    {activeReport.statistics.bloodPressure.count === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No blood pressure readings recorded.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {activeReport.statistics.bloodPressure.count} reading(s) ·
                        Avg{" "}
                        {activeReport.statistics.bloodPressure.systolic.average}/
                        {activeReport.statistics.bloodPressure.diastolic.average}{" "}
                        mmHg
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border p-3.5">
                    <h3 className="mb-1 font-semibold text-foreground">
                      Weight ({activeReport.statistics.weight.unit})
                    </h3>
                    {activeReport.statistics.weight.stats.count === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No weight records logged.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Latest: {activeReport.statistics.weight.stats.latest}{" "}
                        {activeReport.statistics.weight.unit}
                        {activeReport.statistics.weight.stats.change !== null
                          ? ` (${activeReport.statistics.weight.stats.change > 0 ? "+" : ""}${activeReport.statistics.weight.stats.change} change)`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Observations */}
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-semibold text-foreground">
                    Descriptive Observations
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                    {activeReport.narrative.observations.map((obs, idx) => (
                      <li key={idx}>{obs}</li>
                    ))}
                  </ul>
                </div>

                {/* Questions for Provider */}
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-semibold text-foreground">
                    Questions to Discuss With Your Healthcare Provider
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                    {activeReport.narrative.providerQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>

                {/* Daily Notes */}
                {activeReport.statistics.notes.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-semibold text-foreground">Notes</h3>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {activeReport.statistics.notes.map((n) => (
                        <li key={n.noteDate}>
                          <strong>{n.noteDate}:</strong> {n.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Data Limitations */}
                <div className="rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
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
