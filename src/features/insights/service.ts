import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMetricDisplayName,
} from "@/features/tracking-config/schedule-utils";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import type { UnifiedMeasurement } from "@/features/measurements/service";
import {
  buildBloodPressureAnalytics,
  buildGlucoseAnalytics,
  buildWeightAnalytics,
  computeRangeCompletionSummary,
  getDateRangeBounds,
  isIsoInLocalDateRange,
  type DateRangePreset,
  type GlucoseContextFilter,
} from "@/lib/calculations/analytics";
import {
  formatGlucoseContextLabel,
  formatLocalDateTimeLabel,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import type {
  Database,
  MealContext,
  MealTiming,
  MetricType,
  Tables,
  WeightUnit,
} from "@/types/database";

export interface InsightsPayload {
  timezone: string;
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  glucoseContext: GlucoseContextFilter;
  glucose: ReturnType<typeof buildGlucoseAnalytics>;
  bloodPressure: ReturnType<typeof buildBloodPressureAnalytics>;
  weight: ReturnType<typeof buildWeightAnalytics>;
  completion: ReturnType<typeof computeRangeCompletionSummary>;
  history: UnifiedMeasurement[];
  configs: Tables<"tracking_configs">[];
}

export async function getInsightsData(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: {
    preset?: DateRangePreset;
    customStart?: string | null;
    customEnd?: string | null;
    glucoseContext?: GlucoseContextFilter;
    historyMetric?: MetricType | "all";
    search?: string;
  }
): Promise<InsightsPayload> {
  const [{ data: profile }, configs] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle(),
    ensureAndListTrackingConfigs(supabase, userId),
  ]);

  const timezone = safeTimezone(profile?.timezone);
  const preset = options?.preset ?? "14d";
  const glucoseContext = options?.glucoseContext ?? "all";
  const { startDate, endDate, startIso, endIso } = getDateRangeBounds({
    preset,
    customStart: options?.customStart,
    customEnd: options?.customEnd,
    timezone,
  });

  const [glucoseRes, bpRes, weightRes, customRes, skipsRes] = await Promise.all(
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
        .from("measurement_skips")
        .select("*")
        .eq("user_id", userId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate),
    ]
  );

  const glucoseRecords = (glucoseRes.data ?? []).filter((r) =>
    isIsoInLocalDateRange(r.measured_at, startDate, endDate, timezone)
  );
  const bpRecords = (bpRes.data ?? []).filter((r) =>
    isIsoInLocalDateRange(r.measured_at, startDate, endDate, timezone)
  );
  const weightRecords = (weightRes.data ?? []).filter((r) =>
    isIsoInLocalDateRange(r.measured_at, startDate, endDate, timezone)
  );
  const customRecords = (customRes.data ?? []).filter((r) =>
    isIsoInLocalDateRange(r.measured_at, startDate, endDate, timezone)
  );
  const skips = skipsRes.data ?? [];

  const glucoseUnit =
    configs.find((c) => c.metric_type === "glucose")?.unit ?? "mg/dL";
  const weightUnit =
    (configs.find((c) => c.metric_type === "weight")?.unit as WeightUnit) ??
    "kg";

  const customNameMap = new Map(
    configs
      .filter((c) => c.metric_type === "custom")
      .map((c) => [c.id, getMetricDisplayName(c)])
  );

  const allHistory: UnifiedMeasurement[] = [
    ...glucoseRecords.map((r) => ({
      id: r.id,
      metricType: "glucose" as const,
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
    })),
    ...bpRecords.map((r) => ({
      id: r.id,
      metricType: "blood_pressure" as const,
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
    })),
    ...weightRecords.map((r) => ({
      id: r.id,
      metricType: "weight" as const,
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
    })),
    ...customRecords.map((r) => {
      const val =
        r.value_numeric !== null
          ? String(r.value_numeric)
          : (r.value_text ?? "");
      return {
        id: r.id,
        metricType: "custom" as const,
        metricLabel: customNameMap.get(r.metric_config_id) ?? "Custom Metric",
        displayValue: r.unit ? `${val} ${r.unit}` : val,
        unit: r.unit ?? "",
        contextLabel: "Custom record",
        measuredAt: r.measured_at,
        measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
        enteredAt: r.entered_at,
        notes: r.notes,
        source: r.source,
        rawCustom: r,
      };
    }),
  ].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));

  const metricFilter = options?.historyMetric ?? "all";
  const searchQuery = options?.search?.trim().toLowerCase() ?? "";

  const filteredHistory = allHistory.filter((item) => {
    if (metricFilter !== "all" && item.metricType !== metricFilter) {
      return false;
    }
    if (searchQuery) {
      const haystack =
        `${item.metricLabel} ${item.displayValue} ${item.contextLabel} ${item.notes ?? ""}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  });

  const glucose = buildGlucoseAnalytics(
    glucoseRecords,
    timezone,
    glucoseUnit,
    glucoseContext
  );
  const bloodPressure = buildBloodPressureAnalytics(bpRecords, timezone);
  const weight = buildWeightAnalytics(weightRecords, timezone, weightUnit);
  const completion = computeRangeCompletionSummary({
    configs,
    skipsCount: skips.length,
    recordedCount: allHistory.length,
    startDate,
    endDate,
  });

  return {
    timezone,
    preset,
    startDate,
    endDate,
    glucoseContext,
    glucose,
    bloodPressure,
    weight,
    completion,
    history: filteredHistory,
    configs,
  };
}
