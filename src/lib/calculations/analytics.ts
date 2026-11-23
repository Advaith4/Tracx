import {
  formatGlucoseContextLabel,
  formatLocalDateTimeLabel,
  getLocalDateString,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import { parseSchedule } from "@/features/tracking-config/schedule-utils";
import type {
  MealContext,
  MealTiming,
  Tables,
  WeightUnit,
} from "@/types/database";

export type DateRangePreset = "7d" | "14d" | "30d" | "custom";

export type GlucoseContextFilter =
  | "fasting"
  | "before_meals"
  | "after_meals"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "all";

export interface NumericStats {
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  latest: number | null;
  earliest: number | null;
  change: number | null;
}

export interface GlucosePoint {
  id: string;
  measuredAt: string;
  dateLabel: string;
  fullLabel: string;
  value: number;
  unit: string;
  contextGroup: "fasting" | "before" | "after" | "other";
  contextLabel: string;
}

export interface BloodPressurePoint {
  id: string;
  measuredAt: string;
  dateLabel: string;
  fullLabel: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

export interface WeightPoint {
  id: string;
  measuredAt: string;
  dateLabel: string;
  fullLabel: string;
  value: number;
  unit: WeightUnit;
}

export function roundToOneDecimal(num: number): number {
  return Math.round(num * 10) / 10;
}

export function computeNumericStats(values: number[]): NumericStats {
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      average: null,
      latest: null,
      earliest: null,
      change: null,
    };
  }

  let min = values[0];
  let max = values[0];
  let sum = 0;

  for (const val of values) {
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
  }

  const earliest = values[0];
  const latest = values[values.length - 1];

  return {
    count: values.length,
    min: roundToOneDecimal(min),
    max: roundToOneDecimal(max),
    average: roundToOneDecimal(sum / values.length),
    latest: roundToOneDecimal(latest),
    earliest: roundToOneDecimal(earliest),
    change: values.length >= 2 ? roundToOneDecimal(latest - earliest) : null,
  };
}

export function getDateRangeBounds(params: {
  preset: DateRangePreset;
  customStart?: string | null;
  customEnd?: string | null;
  timezone?: string;
  referenceDate?: Date;
}): {
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
} {
  const tz = safeTimezone(params.timezone);
  const now = params.referenceDate ?? new Date();
  const todayStr = getLocalDateString(now, tz);

  let startDate = todayStr;
  let endDate = todayStr;

  if (
    params.preset === "custom" &&
    params.customStart &&
    params.customEnd &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.customStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.customEnd)
  ) {
    startDate =
      params.customStart <= params.customEnd
        ? params.customStart
        : params.customEnd;
    endDate =
      params.customStart <= params.customEnd
        ? params.customEnd
        : params.customStart;
  } else {
    const days =
      params.preset === "7d" ? 7 : params.preset === "30d" ? 30 : 14;
    const startMs = now.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
    startDate = getLocalDateString(new Date(startMs), tz);
  }

  // Pad UTC bounds by +/- 14h to cover every IANA timezone safely before local-date filtering.
  const startUtc = new Date(`${startDate}T00:00:00.000Z`);
  const endUtc = new Date(`${endDate}T23:59:59.999Z`);

  return {
    startDate,
    endDate,
    startIso: new Date(startUtc.getTime() - 14 * 60 * 60 * 1000).toISOString(),
    endIso: new Date(endUtc.getTime() + 14 * 60 * 60 * 1000).toISOString(),
  };
}

export function isIsoInLocalDateRange(
  iso: string,
  startDate: string,
  endDate: string,
  timezone = "UTC"
): boolean {
  const localDate = getLocalDateString(new Date(iso), timezone);
  return localDate >= startDate && localDate <= endDate;
}

export function filterGlucoseByContext(
  records: Tables<"glucose_records">[],
  filter: GlucoseContextFilter
): Tables<"glucose_records">[] {
  if (filter === "all") return records;
  if (filter === "fasting") {
    return records.filter((r) => r.meal_context === "fasting");
  }
  if (filter === "before_meals") {
    return records.filter((r) => r.timing === "before");
  }
  if (filter === "after_meals") {
    return records.filter((r) => r.timing === "after");
  }
  return records.filter((r) => r.meal_context === filter);
}

export function convertGlucoseValue(
  value: number,
  fromUnit: string,
  toUnit: string
): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === "mmol/L" && toUnit === "mg/dL") {
    return roundToOneDecimal(value * 18.0182);
  }
  if (fromUnit === "mg/dL" && toUnit === "mmol/L") {
    return roundToOneDecimal(value / 18.0182);
  }
  return value;
}

export function convertWeightValue(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === "lb" && toUnit === "kg") {
    return roundToOneDecimal(value * 0.453592);
  }
  if (fromUnit === "kg" && toUnit === "lb") {
    return roundToOneDecimal(value / 0.453592);
  }
  return value;
}

function formatShortChartDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function buildGlucoseAnalytics(
  records: Tables<"glucose_records">[],
  timezone: string,
  targetUnit = "mg/dL",
  filter: GlucoseContextFilter = "all"
) {
  const sortedAsc = [...records].sort((a, b) =>
    a.measured_at.localeCompare(b.measured_at)
  );
  const filtered = filterGlucoseByContext(sortedAsc, filter);

  const normalize = (r: Tables<"glucose_records">) =>
    convertGlucoseValue(Number(r.value), r.unit, targetUnit);

  const points: GlucosePoint[] = filtered.map((r) => {
    const contextGroup =
      r.meal_context === "fasting"
        ? "fasting"
        : r.timing === "before"
          ? "before"
          : r.timing === "after"
            ? "after"
            : "other";

    return {
      id: r.id,
      measuredAt: r.measured_at,
      dateLabel: formatShortChartDate(r.measured_at, timezone),
      fullLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
      value: normalize(r),
      unit: targetUnit,
      contextGroup,
      contextLabel: formatGlucoseContextLabel(
        r.meal_context as MealContext,
        r.timing as MealTiming,
        r.elapsed_minutes
      ),
    };
  });

  // Never merge fasting and post-meal readings into one combined average.
  const fastingStats = computeNumericStats(
    sortedAsc.filter((r) => r.meal_context === "fasting").map(normalize)
  );
  const beforeMealStats = computeNumericStats(
    sortedAsc.filter((r) => r.timing === "before").map(normalize)
  );
  const afterMealStats = computeNumericStats(
    sortedAsc.filter((r) => r.timing === "after").map(normalize)
  );
  const filteredStats =
    filter === "all" ? null : computeNumericStats(filtered.map(normalize));

  return {
    unit: targetUnit,
    totalCount: filtered.length,
    points,
    filteredStats,
    breakdowns: {
      fasting: fastingStats,
      beforeMeals: beforeMealStats,
      afterMeals: afterMealStats,
    },
  };
}

export function buildBloodPressureAnalytics(
  records: Tables<"blood_pressure_records">[],
  timezone: string
) {
  const sortedAsc = [...records].sort((a, b) =>
    a.measured_at.localeCompare(b.measured_at)
  );

  const points: BloodPressurePoint[] = sortedAsc.map((r) => ({
    id: r.id,
    measuredAt: r.measured_at,
    dateLabel: formatShortChartDate(r.measured_at, timezone),
    fullLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
  }));

  const systolicStats = computeNumericStats(sortedAsc.map((r) => r.systolic));
  const diastolicStats = computeNumericStats(
    sortedAsc.map((r) => r.diastolic)
  );
  const pulseValues = sortedAsc
    .map((r) => r.pulse)
    .filter((p): p is number => p !== null);
  const pulseStats = computeNumericStats(pulseValues);

  return {
    count: sortedAsc.length,
    points,
    systolic: systolicStats,
    diastolic: diastolicStats,
    pulse: pulseStats,
  };
}

export function buildWeightAnalytics(
  records: Tables<"weight_records">[],
  timezone: string,
  targetUnit: WeightUnit = "kg"
) {
  const sortedAsc = [...records].sort((a, b) =>
    a.measured_at.localeCompare(b.measured_at)
  );

  const points: WeightPoint[] = sortedAsc.map((r) => ({
    id: r.id,
    measuredAt: r.measured_at,
    dateLabel: formatShortChartDate(r.measured_at, timezone),
    fullLabel: formatLocalDateTimeLabel(r.measured_at, timezone),
    value: convertWeightValue(Number(r.value), r.unit, targetUnit),
    unit: targetUnit,
  }));

  const stats = computeNumericStats(points.map((p) => p.value));

  return {
    unit: targetUnit,
    points,
    stats,
  };
}

export function computeRangeCompletionSummary(params: {
  configs: Tables<"tracking_configs">[];
  skipsCount: number;
  recordedCount: number;
  startDate: string;
  endDate: string;
}) {
  const start = new Date(`${params.startDate}T00:00:00.000Z`);
  const end = new Date(`${params.endDate}T00:00:00.000Z`);
  let scheduledSlots = 0;

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const dow = cursor.getUTCDay();
    for (const cfg of params.configs) {
      if (!cfg.enabled) continue;
      const schedule = parseSchedule(cfg.schedule);
      for (const slot of schedule.slots) {
        if (slot.daysOfWeek.includes(dow)) {
          scheduledSlots += 1;
        }
      }
    }
  }

  return {
    scheduledSlots,
    recordedCount: params.recordedCount,
    skippedCount: params.skipsCount,
    completionPercent:
      scheduledSlots > 0
        ? Math.min(Math.round((params.recordedCount / scheduledSlots) * 100), 100)
        : null,
  };
}
