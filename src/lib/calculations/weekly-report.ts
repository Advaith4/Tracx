import {
  computeNumericStats,
  computeRangeCompletionSummary,
  convertGlucoseValue,
  convertWeightValue,
  isIsoInLocalDateRange,
  type NumericStats,
} from "@/lib/calculations/analytics";
import {
  formatLocalDateTimeLabel,
  getLocalDateString,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import type { WeeklyReportAiNarrative } from "@/features/weekly-reports/schemas";
import type { Tables, WeightUnit } from "@/types/database";

export interface GlucoseContextBreakdown {
  key:
    | "fasting"
    | "beforeBreakfast"
    | "afterBreakfast"
    | "beforeLunch"
    | "afterLunch"
    | "beforeDinner"
    | "afterDinner";
  label: string;
  stats: NumericStats;
}

export interface WeeklyReportStatistics {
  periodStart: string;
  periodEnd: string;
  timezone: string;
  overview: {
    totalScheduled: number;
    totalRecorded: number;
    totalSkipped: number;
    missingCount: number;
    completionPercent: number | null;
  };
  glucose: {
    unit: string;
    totalCount: number;
    contexts: GlucoseContextBreakdown[];
  };
  bloodPressure: {
    count: number;
    systolic: NumericStats;
    diastolic: NumericStats;
    pulse: NumericStats;
    readings: Array<{ measuredAtLabel: string; value: string }>;
  };
  weight: {
    unit: WeightUnit;
    stats: NumericStats;
    readings: Array<{ measuredAtLabel: string; value: string }>;
  };
  notes: Array<{ noteDate: string; content: string }>;
  dataLimitations: string[];
}

export function getDefaultWeeklyPeriod(
  timezone = "UTC",
  referenceDate = new Date()
): { periodStart: string; periodEnd: string } {
  const tz = safeTimezone(timezone);
  const periodEnd = getLocalDateString(referenceDate, tz);
  const startMs = referenceDate.getTime() - 6 * 24 * 60 * 60 * 1000;
  const periodStart = getLocalDateString(new Date(startMs), tz);
  return { periodStart, periodEnd };
}

export function computeWeeklyReportStatistics(params: {
  periodStart: string;
  periodEnd: string;
  timezone: string;
  configs: Tables<"tracking_configs">[];
  glucoseRecords: Tables<"glucose_records">[];
  bpRecords: Tables<"blood_pressure_records">[];
  weightRecords: Tables<"weight_records">[];
  customRecords: Tables<"custom_metric_records">[];
  skips: Tables<"measurement_skips">[];
  dailyNotes: Tables<"daily_notes">[];
}): WeeklyReportStatistics {
  const tz = safeTimezone(params.timezone);
  const { periodStart, periodEnd } = params;

  const glucose = params.glucoseRecords
    .filter((r) => isIsoInLocalDateRange(r.measured_at, periodStart, periodEnd, tz))
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const bp = params.bpRecords
    .filter((r) => isIsoInLocalDateRange(r.measured_at, periodStart, periodEnd, tz))
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const weight = params.weightRecords
    .filter((r) => isIsoInLocalDateRange(r.measured_at, periodStart, periodEnd, tz))
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const custom = params.customRecords.filter((r) =>
    isIsoInLocalDateRange(r.measured_at, periodStart, periodEnd, tz)
  );
  const skips = params.skips.filter(
    (s) => s.scheduled_date >= periodStart && s.scheduled_date <= periodEnd
  );

  const totalRecorded =
    glucose.length + bp.length + weight.length + custom.length;

  const completion = computeRangeCompletionSummary({
    configs: params.configs,
    skipsCount: skips.length,
    recordedCount: totalRecorded,
    startDate: periodStart,
    endDate: periodEnd,
  });

  const missingCount = Math.max(
    completion.scheduledSlots - totalRecorded - skips.length,
    0
  );

  const glucoseUnit =
    params.configs.find((c) => c.metric_type === "glucose")?.unit ?? "mg/dL";
  const normalizeGlucose = (r: Tables<"glucose_records">) =>
    convertGlucoseValue(Number(r.value), r.unit, glucoseUnit);

  const contexts: GlucoseContextBreakdown[] = [
    {
      key: "fasting",
      label: "Fasting",
      stats: computeNumericStats(
        glucose.filter((r) => r.meal_context === "fasting").map(normalizeGlucose)
      ),
    },
    {
      key: "beforeBreakfast",
      label: "Before Breakfast",
      stats: computeNumericStats(
        glucose
          .filter(
            (r) => r.meal_context === "breakfast" && r.timing === "before"
          )
          .map(normalizeGlucose)
      ),
    },
    {
      key: "afterBreakfast",
      label: "After Breakfast",
      stats: computeNumericStats(
        glucose
          .filter(
            (r) => r.meal_context === "breakfast" && r.timing === "after"
          )
          .map(normalizeGlucose)
      ),
    },
    {
      key: "beforeLunch",
      label: "Before Lunch",
      stats: computeNumericStats(
        glucose
          .filter((r) => r.meal_context === "lunch" && r.timing === "before")
          .map(normalizeGlucose)
      ),
    },
    {
      key: "afterLunch",
      label: "After Lunch",
      stats: computeNumericStats(
        glucose
          .filter((r) => r.meal_context === "lunch" && r.timing === "after")
          .map(normalizeGlucose)
      ),
    },
    {
      key: "beforeDinner",
      label: "Before Dinner",
      stats: computeNumericStats(
        glucose
          .filter((r) => r.meal_context === "dinner" && r.timing === "before")
          .map(normalizeGlucose)
      ),
    },
    {
      key: "afterDinner",
      label: "After Dinner",
      stats: computeNumericStats(
        glucose
          .filter((r) => r.meal_context === "dinner" && r.timing === "after")
          .map(normalizeGlucose)
      ),
    },
  ];

  const weightUnit =
    (params.configs.find((c) => c.metric_type === "weight")?.unit as WeightUnit) ??
    "kg";
  const weightValues = weight.map((w) =>
    convertWeightValue(Number(w.value), w.unit, weightUnit)
  );
  const weightStats = computeNumericStats(weightValues);

  const dataLimitations: string[] = [];
  if (totalRecorded === 0) {
    dataLimitations.push(
      "No measurements were recorded during this reporting period."
    );
  }
  if (missingCount > 0) {
    dataLimitations.push(
      `${missingCount} scheduled check-in(s) have no recorded or skipped entry and remain missing.`
    );
  }
  if (skips.length > 0) {
    dataLimitations.push(
      `${skips.length} scheduled check-in(s) were explicitly marked as skipped.`
    );
  }
  dataLimitations.push(
    "This report summarizes user-entered measurements only and does not provide medical diagnosis or targets."
  );

  return {
    periodStart,
    periodEnd,
    timezone: tz,
    overview: {
      totalScheduled: completion.scheduledSlots,
      totalRecorded,
      totalSkipped: skips.length,
      missingCount,
      completionPercent: completion.completionPercent,
    },
    glucose: {
      unit: glucoseUnit,
      totalCount: glucose.length,
      contexts,
    },
    bloodPressure: {
      count: bp.length,
      systolic: computeNumericStats(bp.map((b) => b.systolic)),
      diastolic: computeNumericStats(bp.map((b) => b.diastolic)),
      pulse: computeNumericStats(
        bp.map((b) => b.pulse).filter((p): p is number => p !== null)
      ),
      readings: bp.map((b) => ({
        measuredAtLabel: formatLocalDateTimeLabel(b.measured_at, tz),
        value: b.pulse
          ? `${b.systolic}/${b.diastolic} mmHg (Pulse ${b.pulse})`
          : `${b.systolic}/${b.diastolic} mmHg`,
      })),
    },
    weight: {
      unit: weightUnit,
      stats: weightStats,
      readings: weight.map((w) => ({
        measuredAtLabel: formatLocalDateTimeLabel(w.measured_at, tz),
        value: `${convertWeightValue(Number(w.value), w.unit, weightUnit)} ${weightUnit}`,
      })),
    },
    notes: params.dailyNotes
      .filter((n) => n.note_date >= periodStart && n.note_date <= periodEnd)
      .sort((a, b) => a.note_date.localeCompare(b.note_date))
      .map((n) => ({ noteDate: n.note_date, content: n.content })),
    dataLimitations,
  };
}

export function buildDeterministicFallbackNarrative(
  stats: WeeklyReportStatistics
): WeeklyReportAiNarrative {
  const observations: string[] = [];

  observations.push(
    `You recorded ${stats.overview.totalRecorded} measurement(s) between ${stats.periodStart} and ${stats.periodEnd}.`
  );

  const fasting = stats.glucose.contexts.find((c) => c.key === "fasting");
  if (fasting && fasting.stats.count > 0) {
    observations.push(
      `Fasting blood glucose was recorded ${fasting.stats.count} time(s), ranging from ${fasting.stats.min} to ${fasting.stats.max} ${stats.glucose.unit}.`
    );
  }

  if (stats.bloodPressure.count > 0) {
    observations.push(
      `Blood pressure was recorded ${stats.bloodPressure.count} time(s).`
    );
  }

  if (stats.overview.missingCount > 0) {
    observations.push(
      `There were ${stats.overview.missingCount} scheduled check-in(s) without a recorded value during this period.`
    );
  }

  return {
    summaryParagraph: `Summary for ${stats.periodStart} to ${stats.periodEnd}: ${stats.overview.totalRecorded} measurement(s) recorded across your active tracking schedule.`,
    observations,
    providerQuestions: [
      "Would you like to review any variation across these recorded readings together?",
      "Should any scheduled measurement times or contexts be adjusted for the coming week?",
    ],
  };
}
