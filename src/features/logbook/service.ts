import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnifiedMeasurement } from "@/features/measurements/service";
import { getMetricDisplayName } from "@/features/tracking-config/schedule-utils";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import {
  buildDailySpreadsheet,
  type SpreadsheetData,
} from "@/features/logbook/build-spreadsheet";
import {
  getDateRangeBounds,
  isIsoInLocalDateRange,
  type DateRangePreset,
} from "@/lib/calculations/analytics";
import {
  formatGlucoseContextLabel,
  formatLocalDateTimeLabel,
  getLocalDateString,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import type {
  Database,
  MealContext,
  MealTiming,
  Tables,
} from "@/types/database";

export type LogbookRangePreset = DateRangePreset | "90d" | "all";

export interface LogbookPayload {
  timezone: string;
  preset: LogbookRangePreset;
  startDate: string;
  endDate: string;
  configs: Tables<"tracking_configs">[];
  entries: UnifiedMeasurement[];
  spreadsheet: SpreadsheetData;
}

function resolveLogbookBounds(params: {
  preset: LogbookRangePreset;
  customStart?: string | null;
  customEnd?: string | null;
  timezone: string;
}) {
  const tz = safeTimezone(params.timezone);
  const now = new Date();
  const todayStr = getLocalDateString(now, tz);

  if (params.preset === "90d") {
    const startMs = now.getTime() - 89 * 24 * 60 * 60 * 1000;
    const startDate = getLocalDateString(new Date(startMs), tz);
    return {
      startDate,
      endDate: todayStr,
      startIso: new Date(startMs - 24 * 60 * 60 * 1000).toISOString(),
      endIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  if (params.preset === "all") {
    const startMs = now.getTime() - 179 * 24 * 60 * 60 * 1000;
    const startDate = getLocalDateString(new Date(startMs), tz);
    return {
      startDate,
      endDate: todayStr,
      startIso: new Date("2020-01-01T00:00:00.000Z").toISOString(),
      endIso: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  return getDateRangeBounds({
    preset: params.preset,
    customStart: params.customStart,
    customEnd: params.customEnd,
    timezone: tz,
  });
}

export async function getLogbookData(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: {
    preset?: LogbookRangePreset;
    customStart?: string | null;
    customEnd?: string | null;
  }
): Promise<LogbookPayload> {
  const [{ data: profile }, configs] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle(),
    ensureAndListTrackingConfigs(supabase, userId),
  ]);

  const timezone = safeTimezone(profile?.timezone);
  const preset: LogbookRangePreset = options?.preset ?? "30d";

  const { startDate, endDate, startIso, endIso } = resolveLogbookBounds({
    preset,
    customStart: options?.customStart,
    customEnd: options?.customEnd,
    timezone,
  });

  const [glucoseRes, bpRes, weightRes, customRes, notesRes] = await Promise.all(
    [
      supabase
        .from("glucose_records")
        .select("*")
        .eq("user_id", userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso)
        .order("measured_at", { ascending: false }),
      supabase
        .from("blood_pressure_records")
        .select("*")
        .eq("user_id", userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso)
        .order("measured_at", { ascending: false }),
      supabase
        .from("weight_records")
        .select("*")
        .eq("user_id", userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso)
        .order("measured_at", { ascending: false }),
      supabase
        .from("custom_metric_records")
        .select("*")
        .eq("user_id", userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso)
        .order("measured_at", { ascending: false }),
      supabase
        .from("daily_notes")
        .select("note_date, content")
        .eq("user_id", userId)
        .gte("note_date", startDate)
        .lte("note_date", endDate)
        .order("note_date", { ascending: false }),
    ]
  );

  const inRange = (iso: string) =>
    preset === "all"
      ? true
      : isIsoInLocalDateRange(iso, startDate, endDate, timezone);

  const customNameMap = new Map(
    configs
      .filter((c) => c.metric_type === "custom")
      .map((c) => [c.id, getMetricDisplayName(c)])
  );

  const entries: UnifiedMeasurement[] = [];

  for (const r of glucoseRes.data ?? []) {
    if (!inRange(r.measured_at)) continue;
    entries.push({
      id: r.id,
      metricType: "glucose",
      metricLabel: "Blood Glucose",
      displayValue: `${r.value} ${r.unit}`,
      unit: r.unit,
      contextLabel: formatGlucoseContextLabel(
        r.meal_context as MealContext,
        r.timing as MealTiming,
        r.elapsed_minutes
      ),
      measuredAt: r.measured_at,
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawGlucose: r,
    });
  }

  for (const r of bpRes.data ?? []) {
    if (!inRange(r.measured_at)) continue;
    entries.push({
      id: r.id,
      metricType: "blood_pressure",
      metricLabel: "Blood Pressure",
      displayValue: `${r.systolic}/${r.diastolic} mmHg`,
      unit: "mmHg",
      contextLabel: r.pulse ? `Pulse ${r.pulse} bpm` : "Reading",
      measuredAt: r.measured_at,
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawBloodPressure: r,
    });
  }

  for (const r of weightRes.data ?? []) {
    if (!inRange(r.measured_at)) continue;
    entries.push({
      id: r.id,
      metricType: "weight",
      metricLabel: "Weight",
      displayValue: `${r.value} ${r.unit}`,
      unit: r.unit,
      contextLabel: "Weight check-in",
      measuredAt: r.measured_at,
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawWeight: r,
    });
  }

  for (const r of customRes.data ?? []) {
    if (!inRange(r.measured_at)) continue;
    const val =
      r.value_numeric !== null
        ? String(r.value_numeric)
        : (r.value_text ?? "");
    entries.push({
      id: r.id,
      metricType: "custom",
      metricLabel: customNameMap.get(r.metric_config_id) ?? "Custom",
      displayValue: r.unit ? `${val} ${r.unit}` : val,
      unit: r.unit ?? "",
      contextLabel: "Custom metric",
      measuredAt: r.measured_at,
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawCustom: r,
    });
  }

  entries.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));

  const spreadsheet = buildDailySpreadsheet({
    entries,
    dailyNotes: notesRes.data ?? [],
    configs,
    startDate,
    endDate,
    timezone,
  });

  return {
    timezone,
    preset,
    startDate,
    endDate,
    configs,
    entries,
    spreadsheet,
  };
}
