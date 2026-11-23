"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  List,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Table2,
  Trash2,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/feedback-states";
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
import { Textarea } from "@/components/ui/textarea";
import {
  buildAllEntriesCsv,
  buildDailySheetCsv,
  GLUCOSE_SHEET_COLUMNS,
  type SpreadsheetCellEntry,
} from "@/features/logbook/build-spreadsheet";
import type {
  LogbookPayload,
  LogbookRangePreset,
} from "@/features/logbook/service";
import { BloodPressureForm } from "@/features/measurements/components/blood-pressure-form";
import { CustomMetricForm } from "@/features/measurements/components/custom-metric-form";
import { GlucoseForm } from "@/features/measurements/components/glucose-form";
import { WeightForm } from "@/features/measurements/components/weight-form";
import type { UnifiedMeasurement } from "@/features/measurements/service";
import { getLocalDateString, getLocalHHMM } from "@/lib/calculations/daily-status";
import { cn } from "@/lib/utils";
import type { MetricType } from "@/types/database";

type SheetMode = "daily_sheet" | "all_entries";

interface LogbookWorkspaceProps {
  userId: string;
  initialData?: LogbookPayload;
  defaultPreset?: LogbookRangePreset;
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

function triggerCsvDownload(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function CellChipList({
  entries,
  onSelectEntry,
}: {
  entries: SpreadsheetCellEntry[];
  onSelectEntry: (item: UnifiedMeasurement) => void;
}) {
  if (entries.length === 0) {
    return <span className="text-muted-foreground/45">-</span>;
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSelectEntry(entry.measurement)}
          title={`${entry.timeLabel}${entry.notes ? ` · ${entry.notes}` : ""} (Click to edit)`}
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums transition-colors hover:ring-1 hover:ring-primary/60",
            entry.aboveReference
              ? "bg-amber-100/90 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
              : "text-foreground hover:bg-primary/10"
          )}
        >
          {entry.displayText}
        </button>
      ))}
    </div>
  );
}

export function LogbookWorkspace({
  userId,
  initialData,
  defaultPreset = "30d",
}: LogbookWorkspaceProps) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<SheetMode>("daily_sheet");
  const [preset, setPreset] = useState<LogbookRangePreset>(
    initialData?.preset ?? defaultPreset
  );
  const [customStart, setCustomStart] = useState(
    initialData?.startDate ?? ""
  );
  const [customEnd, setCustomEnd] = useState(initialData?.endDate ?? "");
  const [showEmptyDays, setShowEmptyDays] = useState(false);

  const [search, setSearch] = useState("");
  const [metricFilter, setMetricFilter] = useState<MetricType | "all">("all");
  const [sortAsc, setSortAsc] = useState(false);

  const [editingItem, setEditingItem] = useState<UnifiedMeasurement | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<UnifiedMeasurement | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const [noteModal, setNoteModal] = useState<{
    date: string;
    content: string;
  } | null>(null);

  const isDefaultInitial =
    Boolean(initialData) &&
    preset === (initialData?.preset ?? defaultPreset) &&
    !customStart &&
    !customEnd;

  const { data, isLoading, isFetching, error, refetch } =
    useQuery<LogbookPayload>({
      queryKey: ["logbook", userId, preset, customStart, customEnd],
      initialData: isDefaultInitial ? initialData : undefined,
      queryFn: async () => {
        const params = new URLSearchParams({ preset });
        if (preset === "custom" && customStart) params.set("start", customStart);
        if (preset === "custom" && customEnd) params.set("end", customEnd);

        const res = await fetch(`/api/logbook?${params.toString()}`);
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? "Couldn't load logbook.");
        }
        return json.data as LogbookPayload;
      },
    });

  const visibleSheetRows = useMemo(() => {
    if (!data) return [];
    const base = showEmptyDays
      ? data.spreadsheet.rows
      : data.spreadsheet.rows.filter(
          (r) => r.totalCount > 0 || r.dailyNote.trim().length > 0
        );
    return sortAsc ? [...base].reverse() : base;
  }, [data, showEmptyDays, sortAsc]);

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = data.entries.filter((item) => {
      if (metricFilter !== "all" && item.metricType !== metricFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.metricLabel.toLowerCase().includes(q) ||
        item.displayValue.toLowerCase().includes(q) ||
        item.contextLabel.toLowerCase().includes(q) ||
        (item.notes ?? "").toLowerCase().includes(q) ||
        item.measuredAtLabel.toLowerCase().includes(q)
      );
    });
    return sortAsc ? [...list].reverse() : list;
  }, [data, search, metricFilter, sortAsc]);

  function refreshAll() {
    setEditingItem(null);
    void queryClient.invalidateQueries({ queryKey: ["logbook"] });
    void queryClient.invalidateQueries({ queryKey: ["insights"] });
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const saveNoteMutation = useMutation({
    mutationFn: async (params: { date: string; content: string }) => {
      const res = await fetch("/api/daily-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_date: params.date,
          content: params.content.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't save daily note.");
      }
    },
    onSuccess: () => {
      setNoteModal(null);
      refreshAll();
      toast.success("Daily note updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  async function handleConfirmDelete() {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const res = await fetch(getDeleteEndpoint(deletingItem), {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't delete measurement.");
        return;
      }
      setDeletingItem(null);
      toast.success("Measurement deleted");
      refreshAll();
    } catch {
      toast.error("Couldn't delete record.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleExportCsv() {
    if (!data) return;
    if (mode === "daily_sheet") {
      const csv = buildDailySheetCsv(data.spreadsheet, {
        includeEmptyDays: showEmptyDays,
      });
      triggerCsvDownload(`tracx-daily-sheet-${data.endDate}.csv`, csv);
      toast.success("Exported Daily Sheet CSV (opens in Excel)");
    } else {
      const csv = buildAllEntriesCsv(filteredEntries, data.timezone);
      triggerCsvDownload(`tracx-all-recordings-${data.endDate}.csv`, csv);
      toast.success("Exported All Recordings CSV (opens in Excel)");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setMode("daily_sheet")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                mode === "daily_sheet"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Table2 className="size-3.5" aria-hidden="true" />
              Daily Sheet (Excel)
            </button>
            <button
              type="button"
              onClick={() => setMode("all_entries")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                mode === "all_entries"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-3.5" aria-hidden="true" />
              All Entries
            </button>
          </div>

          {/* Range Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
              {(
                [
                  { value: "7d", label: "7D" },
                  { value: "14d", label: "14D" },
                  { value: "30d", label: "30D" },
                  { value: "90d", label: "90D" },
                  { value: "all", label: "All" },
                  { value: "custom", label: "Custom" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreset(opt.value)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                    preset === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={!data}
              onClick={handleExportCsv}
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span className="sm:hidden">CSV</span>
              <span className="hidden sm:inline">Export Excel (.csv)</span>
            </Button>

            <Link
              href="/log"
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Log
            </Link>
          </div>
        </div>

        {/* Custom dates or Filters row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {data ? (
              <span>
                {data.spreadsheet.summary.totalDaysWithLogs} active days ·{" "}
                {data.spreadsheet.summary.totalReadings} total readings
                {isFetching ? " · Updating..." : ""}
              </span>
            ) : null}

            {mode === "daily_sheet" ? (
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={showEmptyDays}
                  onChange={(e) => setShowEmptyDays(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                Show empty days
              </label>
            ) : null}

            <button
              type="button"
              onClick={() => setSortAsc((prev) => !prev)}
              className="font-medium text-primary hover:underline"
            >
              Order: {sortAsc ? "Oldest first" : "Newest first"}
            </button>
          </div>

          {preset === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                aria-label="Start date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="End date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          ) : null}
        </div>

        {mode === "all_entries" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search values, meals, contexts, or notes..."
                className="h-9 pl-8 text-xs"
              />
            </div>
            <Select
              value={metricFilter}
              onValueChange={(next) => {
                if (next) setMetricFilter(next as MetricType | "all");
              }}
            >
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue>
                  {(v: string | null) =>
                    v === "glucose"
                      ? "Blood Glucose"
                      : v === "blood_pressure"
                        ? "Blood Pressure"
                        : v === "weight"
                          ? "Weight"
                          : v === "custom"
                            ? "Custom"
                            : "All Metrics"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Metrics</SelectItem>
                <SelectItem value="glucose">Blood Glucose</SelectItem>
                <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                <SelectItem value="weight">Weight</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {isLoading ? <LoadingState rows={5} /> : null}
      {error && !data ? (
        <ErrorState
          message="Couldn't load spreadsheet data."
          onRetry={() => void refetch()}
        />
      ) : null}

      {/* MODE 1: DAILY SHEET (EXCEL PIVOT) */}
      {data && mode === "daily_sheet" ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  Daily Pregnancy Logbook Sheet
                </CardTitle>
                <CardDescription className="text-xs">
                  Each row is one day. Click any value cell to edit or inspect
                  timestamps and notes.
                </CardDescription>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Glucose: {data.spreadsheet.glucoseUnit} · Weight:{" "}
                {data.spreadsheet.weightUnit}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {visibleSheetRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Table2}
                  title="No recordings in this window"
                  description="Switch to a wider date range (like 90D or All), enable 'Show empty days', or log a measurement."
                />
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto border-t border-border/70">
                <table className="w-full min-w-[980px] border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-muted/95 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-30 min-w-[82px] border-r border-border bg-muted px-2.5 py-2.5 text-left sm:min-w-[118px] sm:px-3">
                        Date
                      </th>
                      {GLUCOSE_SHEET_COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="min-w-[82px] border-r border-border/70 px-2 py-2.5 text-center"
                          title={`${col.label} (${data.spreadsheet.glucoseUnit})`}
                        >
                          {col.shortLabel}
                        </th>
                      ))}
                      <th className="min-w-[74px] border-r border-border/70 bg-primary/8 px-2 py-2.5 text-center text-primary">
                        Day Avg
                      </th>
                      <th className="min-w-[106px] border-r border-border/70 px-2 py-2.5 text-center">
                        Blood Pressure
                      </th>
                      <th className="min-w-[82px] border-r border-border/70 px-2 py-2.5 text-center">
                        Weight
                      </th>
                      {data.spreadsheet.customColumns.map((col) => (
                        <th
                          key={col.configId}
                          className="min-w-[88px] border-r border-border/70 px-2 py-2.5 text-center"
                        >
                          {col.label}
                          {col.unit ? ` (${col.unit})` : ""}
                        </th>
                      ))}
                      <th className="min-w-[200px] px-3 py-2.5 text-left">
                        Daily Note
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border/70">
                    {visibleSheetRows.map((row, rowIdx) => (
                      <tr
                        key={row.date}
                        className={cn(
                          "transition-colors hover:bg-primary/4",
                          rowIdx % 2 === 0 ? "bg-card" : "bg-muted/20"
                        )}
                      >
                        <td className="sticky left-0 z-10 border-r border-border bg-card px-2.5 py-2 font-medium sm:px-3">
                          <Link
                            href={`/calendar?date=${row.date}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-1.5 text-foreground hover:text-primary"
                            title="Open day summary in Calendar"
                          >
                            <span className="tabular-nums font-semibold">
                              {row.dateLabel}
                            </span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {row.weekday}
                            </span>
                          </Link>
                        </td>

                        {GLUCOSE_SHEET_COLUMNS.map((col) => (
                          <td
                            key={col.key}
                            className="border-r border-border/60 px-1.5 py-2 text-center align-middle"
                          >
                            <CellChipList
                              entries={row.glucoseCells[col.key]}
                              onSelectEntry={setEditingItem}
                            />
                          </td>
                        ))}

                        <td className="border-r border-border/60 bg-primary/4 px-2 py-2 text-center font-semibold tabular-nums text-foreground">
                          {row.glucoseDayAvg !== null ? row.glucoseDayAvg : "-"}
                        </td>

                        <td className="border-r border-border/60 px-2 py-2 text-center align-middle">
                          <CellChipList
                            entries={row.bloodPressure}
                            onSelectEntry={setEditingItem}
                          />
                        </td>

                        <td className="border-r border-border/60 px-2 py-2 text-center align-middle">
                          <CellChipList
                            entries={row.weight}
                            onSelectEntry={setEditingItem}
                          />
                        </td>

                        {data.spreadsheet.customColumns.map((col) => (
                          <td
                            key={col.configId}
                            className="border-r border-border/60 px-2 py-2 text-center align-middle"
                          >
                            <CellChipList
                              entries={row.customCells[col.configId] ?? []}
                              onSelectEntry={setEditingItem}
                            />
                          </td>
                        ))}

                        <td className="px-3 py-2 text-left align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              setNoteModal({
                                date: row.date,
                                content: row.dailyNote,
                              })
                            }
                            className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                            title="Click to edit daily note"
                          >
                            {row.dailyNote ? (
                              <span className="line-clamp-2 text-foreground">
                                {row.dailyNote}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] opacity-60">
                                <StickyNote
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                Add note
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Summary / Column Average Footer Row */}
                  <tfoot className="sticky bottom-0 z-20 border-t-2 border-border bg-muted/95 font-semibold text-foreground backdrop-blur-sm">
                    <tr>
                      <td className="sticky left-0 z-30 border-r border-border bg-muted px-2.5 py-2.5 text-left text-[10px] uppercase tracking-wide sm:px-3 sm:text-[11px]">
                        Avg / Summary
                      </td>
                      {GLUCOSE_SHEET_COLUMNS.map((col) => {
                        const avg =
                          data.spreadsheet.summary.glucoseSlotAverages[col.key];
                        return (
                          <td
                            key={col.key}
                            className="border-r border-border/70 px-2 py-2.5 text-center tabular-nums"
                          >
                            {avg !== null ? avg : "-"}
                          </td>
                        );
                      })}
                      <td className="border-r border-border/70 bg-primary/10 px-2 py-2.5 text-center tabular-nums text-primary">
                        {data.spreadsheet.summary.overallGlucoseAverage ?? "-"}
                      </td>
                      <td className="border-r border-border/70 px-2 py-2.5 text-center tabular-nums">
                        {data.spreadsheet.summary.avgSystolic !== null &&
                        data.spreadsheet.summary.avgDiastolic !== null
                          ? `${data.spreadsheet.summary.avgSystolic}/${data.spreadsheet.summary.avgDiastolic}`
                          : "-"}
                      </td>
                      <td className="border-r border-border/70 px-2 py-2.5 text-center tabular-nums">
                        {data.spreadsheet.summary.latestWeight !== null
                          ? `${data.spreadsheet.summary.latestWeight}${
                              data.spreadsheet.summary.weightChange !== null
                                ? ` (${data.spreadsheet.summary.weightChange > 0 ? "+" : ""}${data.spreadsheet.summary.weightChange})`
                                : ""
                            }`
                          : "-"}
                      </td>
                      {data.spreadsheet.customColumns.map((col) => (
                        <td
                          key={col.configId}
                          className="border-r border-border/70 px-2 py-2.5 text-center text-[11px] text-muted-foreground"
                        >
                          -
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-left text-[11px] text-muted-foreground">
                        {data.spreadsheet.summary.totalDaysWithLogs} days logged
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* MODE 2: ALL ENTRIES RAW LEDGER TABLE */}
      {data && mode === "all_entries" ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              All Recorded Entries ({filteredEntries.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Line-by-line spreadsheet table of every measurement recorded.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredEntries.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={List}
                  title="No matching entries"
                  description="Try widening the date range or clearing search filters."
                />
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto border-t border-border/70">
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/95 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="border-r border-border/70 px-3 py-2.5 text-left">
                        Date
                      </th>
                      <th className="border-r border-border/70 px-3 py-2.5 text-left">
                        Time
                      </th>
                      <th className="border-r border-border/70 px-3 py-2.5 text-left">
                        Metric
                      </th>
                      <th className="border-r border-border/70 px-3 py-2.5 text-right">
                        Value
                      </th>
                      <th className="border-r border-border/70 px-3 py-2.5 text-left">
                        Context
                      </th>
                      <th className="border-r border-border/70 px-3 py-2.5 text-left">
                        Notes
                      </th>
                      <th className="border-r border-border/70 px-3 py-2.5 text-center">
                        Source
                      </th>
                      <th className="px-3 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {filteredEntries.map((item, idx) => {
                      const localDate = getLocalDateString(
                        new Date(item.measuredAt),
                        data.timezone
                      );
                      const localTime = getLocalHHMM(
                        new Date(item.measuredAt),
                        data.timezone
                      );
                      return (
                        <tr
                          key={`${item.metricType}-${item.id}`}
                          className={cn(
                            "hover:bg-primary/4",
                            idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                          )}
                        >
                          <td className="border-r border-border/60 px-3 py-2 font-medium tabular-nums">
                            {localDate}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 tabular-nums text-muted-foreground">
                            {localTime}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground">
                            {item.metricLabel}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                            {item.displayValue}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted-foreground">
                            {item.contextLabel}
                          </td>
                          <td className="max-w-[240px] truncate border-r border-border/60 px-3 py-2 text-muted-foreground">
                            {item.notes ?? "-"}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-center capitalize text-muted-foreground">
                            {item.source}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                type="button"
                                aria-label={`Edit ${item.metricLabel}`}
                                onClick={() => setEditingItem(item)}
                              >
                                <Pencil className="size-3.5" aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                type="button"
                                aria-label={`Delete ${item.metricLabel}`}
                                onClick={() => setDeletingItem(item)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Edit Measurement Modal */}
      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editingItem?.metricLabel}</DialogTitle>
            <DialogDescription>
              Update the value, context, timestamp, or notes — or delete this
              entry.
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

          {editingItem ? (
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  const target = editingItem;
                  setEditingItem(null);
                  setDeletingItem(target);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete Reading
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
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

      {/* Edit Daily Note Modal */}
      <Dialog
        open={Boolean(noteModal)}
        onOpenChange={(open) => !open && setNoteModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daily Note · {noteModal?.date}</DialogTitle>
            <DialogDescription>
              Record meals, activity, symptoms, or visit notes for this date.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={noteModal?.content ?? ""}
            onChange={(e) =>
              setNoteModal((prev) =>
                prev ? { ...prev, content: e.target.value } : null
              )
            }
            placeholder="Write a note for this date..."
          />
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setNoteModal(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveNoteMutation.isPending}
              onClick={() =>
                noteModal &&
                saveNoteMutation.mutate({
                  date: noteModal.date,
                  content: noteModal.content,
                })
              }
            >
              {saveNoteMutation.isPending ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
