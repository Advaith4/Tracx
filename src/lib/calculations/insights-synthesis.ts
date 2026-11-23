import {
  computeNumericStats,
  convertGlucoseValue,
  convertWeightValue,
  roundToOneDecimal,
  type CustomMetricSeries,
  type NumericStats,
} from "@/lib/calculations/analytics";
import {
  formatGlucoseContextLabel,
  formatLocalDateTimeLabel,
  getLocalDateString,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import {
  parseProviderTargets,
  parseSchedule,
} from "@/features/tracking-config/schedule-utils";
import type { ProviderTargets } from "@/features/tracking-config/schemas";
import type {
  MealContext,
  MealTiming,
  Tables,
  WeightUnit,
} from "@/types/database";

export interface MealComparisonBucket {
  key: string;
  label: string;
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
  withinTargetCount: number | null;
  referenceMax: number | null;
}

export interface PeriodShiftMetric {
  label: string;
  unit: string;
  previousAvg: number | null;
  recentAvg: number | null;
  delta: number | null;
}

export interface DailyActivityDay {
  date: string;
  shortLabel: string;
  weekday: string;
  loggedCount: number;
  scheduledCount: number;
  dailyNote: string | null;
}

export interface SlotConsistencyItem {
  id: string;
  metricLabel: string;
  context: string;
  timeLabel: string;
  expectedCount: number;
  loggedCount: number;
  percent: number;
}

export interface InsightHighlightCard {
  id: string;
  tone: "positive" | "neutral" | "attention";
  badge: string;
  title: string;
  description: string;
  targetTab: "glucose" | "blood_pressure" | "weight" | "custom" | "history";
}

export interface ReadingCallout {
  label: string;
  value: string;
  context: string;
  measuredAtLabel: string;
  note: string | null;
}

export interface InsightsSynthesis {
  mealComparison: MealComparisonBucket[];
  periodShifts: PeriodShiftMetric[];
  dailyActivity: DailyActivityDay[];
  currentStreakDays: number;
  slotConsistency: SlotConsistencyItem[];
  highlights: InsightHighlightCard[];
  glucoseCallouts: {
    highest: ReadingCallout | null;
    lowest: ReadingCallout | null;
    notedCount: number;
  };
  bpCallouts: {
    highest: ReadingCallout | null;
    lowest: ReadingCallout | null;
  };
  weightPacePerWeek: number | null;
  visitPrepBullets: string[];
  providerTargets: {
    glucose: NonNullable<ProviderTargets> | null;
    bloodPressure: NonNullable<ProviderTargets> | null;
    weight: NonNullable<ProviderTargets> | null;
  };
  profileContext: {
    pregnancyWeek: number | null;
    providerName: string | null;
  };
}

function getDateRangeArray(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDayShort(dateStr: string): { shortLabel: string; weekday: string } {
  const dt = new Date(`${dateStr}T12:00:00.000Z`);
  return {
    shortLabel: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(dt),
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
    }).format(dt),
  };
}

function computeHalfShift(
  items: Array<{ date: string; value: number }>,
  midpointDate: string,
  label: string,
  unit: string
): PeriodShiftMetric {
  const firstHalf = items
    .filter((i) => i.date < midpointDate)
    .map((i) => i.value);
  const secondHalf = items
    .filter((i) => i.date >= midpointDate)
    .map((i) => i.value);

  const prevStats = computeNumericStats(firstHalf);
  const recentStats = computeNumericStats(secondHalf);

  const delta =
    prevStats.average !== null && recentStats.average !== null
      ? roundToOneDecimal(recentStats.average - prevStats.average)
      : null;

  return {
    label,
    unit,
    previousAvg: prevStats.average,
    recentAvg: recentStats.average,
    delta,
  };
}

function formatSignedDelta(delta: number, unit: string): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} ${unit}`;
}

export function buildInsightsSynthesis(params: {
  startDate: string;
  endDate: string;
  timezone: string;
  glucoseUnit: string;
  weightUnit: WeightUnit;
  configs: Tables<"tracking_configs">[];
  glucoseRecords: Tables<"glucose_records">[];
  bpRecords: Tables<"blood_pressure_records">[];
  weightRecords: Tables<"weight_records">[];
  customRecords: Tables<"custom_metric_records">[];
  customMetrics: CustomMetricSeries[];
  dailyNotes: Tables<"daily_notes">[];
  pregnancyWeek: number | null;
  providerName: string | null;
}): InsightsSynthesis {
  const tz = safeTimezone(params.timezone);
  const dates = getDateRangeArray(params.startDate, params.endDate);
  const midpointDate =
    dates.length > 1 ? dates[Math.floor(dates.length / 2)] : params.endDate;

  const glucoseConfig = params.configs.find((c) => c.metric_type === "glucose");
  const bpConfig = params.configs.find((c) => c.metric_type === "blood_pressure");
  const weightConfig = params.configs.find((c) => c.metric_type === "weight");

  const glucoseTargets = parseProviderTargets(glucoseConfig?.provider_targets) ?? null;
  const bpTargets = parseProviderTargets(bpConfig?.provider_targets) ?? null;
  const weightTargets = parseProviderTargets(weightConfig?.provider_targets) ?? null;

  const normalizeGlucose = (r: Tables<"glucose_records">) =>
    convertGlucoseValue(Number(r.value), r.unit, params.glucoseUnit);

  // 1. Meal-by-meal glucose breakdown
  const mealDefs: Array<{
    key: string;
    label: string;
    match: (r: Tables<"glucose_records">) => boolean;
    refMax: number | null;
  }> = [
    {
      key: "fasting",
      label: "Fasting",
      match: (r) => r.meal_context === "fasting",
      refMax: glucoseTargets?.fastingMax ?? null,
    },
    {
      key: "before_breakfast",
      label: "Before Breakfast",
      match: (r) => r.meal_context === "breakfast" && r.timing === "before",
      refMax: glucoseTargets?.fastingMax ?? null,
    },
    {
      key: "after_breakfast",
      label: "After Breakfast",
      match: (r) => r.meal_context === "breakfast" && r.timing === "after",
      refMax: glucoseTargets?.postMealMax ?? null,
    },
    {
      key: "before_lunch",
      label: "Before Lunch",
      match: (r) => r.meal_context === "lunch" && r.timing === "before",
      refMax: null,
    },
    {
      key: "after_lunch",
      label: "After Lunch",
      match: (r) => r.meal_context === "lunch" && r.timing === "after",
      refMax: glucoseTargets?.postMealMax ?? null,
    },
    {
      key: "before_dinner",
      label: "Before Dinner",
      match: (r) => r.meal_context === "dinner" && r.timing === "before",
      refMax: null,
    },
    {
      key: "after_dinner",
      label: "After Dinner",
      match: (r) => r.meal_context === "dinner" && r.timing === "after",
      refMax: glucoseTargets?.postMealMax ?? null,
    },
    {
      key: "snack",
      label: "Snack",
      match: (r) => r.meal_context === "snack",
      refMax: glucoseTargets?.postMealMax ?? null,
    },
  ];

  const glucoseAsc = [...params.glucoseRecords].sort((a, b) =>
    a.measured_at.localeCompare(b.measured_at)
  );

  const mealComparison: MealComparisonBucket[] = mealDefs
    .map((def) => {
      const matching = glucoseAsc.filter(def.match);
      const values = matching.map(normalizeGlucose);
      const stats: NumericStats = computeNumericStats(values);
      const withinTargetCount =
        def.refMax !== null && values.length > 0
          ? values.filter((v) => v <= def.refMax!).length
          : null;
      return {
        key: def.key,
        label: def.label,
        count: stats.count,
        average: stats.average,
        min: stats.min,
        max: stats.max,
        latest: stats.latest,
        withinTargetCount,
        referenceMax: def.refMax,
      };
    })
    .filter((b) => b.count > 0);

  // 2. Period half-over-half shifts
  const periodShifts: PeriodShiftMetric[] = [];
  if (dates.length >= 4) {
    const fastingPoints = glucoseAsc
      .filter((r) => r.meal_context === "fasting")
      .map((r) => ({
        date: getLocalDateString(new Date(r.measured_at), tz),
        value: normalizeGlucose(r),
      }));
    if (fastingPoints.length >= 2) {
      periodShifts.push(
        computeHalfShift(
          fastingPoints,
          midpointDate,
          "Fasting Glucose",
          params.glucoseUnit
        )
      );
    }

    const postMealPoints = glucoseAsc
      .filter((r) => r.timing === "after")
      .map((r) => ({
        date: getLocalDateString(new Date(r.measured_at), tz),
        value: normalizeGlucose(r),
      }));
    if (postMealPoints.length >= 2) {
      periodShifts.push(
        computeHalfShift(
          postMealPoints,
          midpointDate,
          "Post-Meal Glucose",
          params.glucoseUnit
        )
      );
    }

    const bpSysPoints = params.bpRecords.map((r) => ({
      date: getLocalDateString(new Date(r.measured_at), tz),
      value: r.systolic,
    }));
    if (bpSysPoints.length >= 2) {
      periodShifts.push(
        computeHalfShift(bpSysPoints, midpointDate, "Systolic BP", "mmHg")
      );
    }
  }

  // 3. Daily adherence heatmap & streak
  const loggedByDate = new Map<string, number>();
  const bumpDate = (iso: string) => {
    const d = getLocalDateString(new Date(iso), tz);
    loggedByDate.set(d, (loggedByDate.get(d) ?? 0) + 1);
  };
  params.glucoseRecords.forEach((r) => bumpDate(r.measured_at));
  params.bpRecords.forEach((r) => bumpDate(r.measured_at));
  params.weightRecords.forEach((r) => bumpDate(r.measured_at));
  params.customRecords.forEach((r) => bumpDate(r.measured_at));

  const notesByDate = new Map(
    params.dailyNotes.map((n) => [n.note_date, n.content])
  );

  const dailyActivity: DailyActivityDay[] = dates.map((dateStr) => {
    const dow = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();
    let scheduledCount = 0;
    for (const cfg of params.configs) {
      if (!cfg.enabled) continue;
      const sched = parseSchedule(cfg.schedule);
      for (const slot of sched.slots) {
        if (slot.daysOfWeek.includes(dow)) scheduledCount += 1;
      }
    }
    const { shortLabel, weekday } = formatDayShort(dateStr);
    return {
      date: dateStr,
      shortLabel,
      weekday,
      loggedCount: loggedByDate.get(dateStr) ?? 0,
      scheduledCount,
      dailyNote: notesByDate.get(dateStr) ?? null,
    };
  });

  // Streak ending at endDate (grace for endDate if today has 0 logs so far)
  let currentStreakDays = 0;
  for (let i = dailyActivity.length - 1; i >= 0; i--) {
    const day = dailyActivity[i];
    if (day.loggedCount > 0) {
      currentStreakDays += 1;
    } else if (i === dailyActivity.length - 1) {
      continue;
    } else {
      break;
    }
  }

  // 4. Slot consistency (glucose slots + BP + Weight + custom)
  const slotConsistency: SlotConsistencyItem[] = [];
  for (const cfg of params.configs) {
    if (!cfg.enabled) continue;
    const sched = parseSchedule(cfg.schedule);
    const metricLabel =
      cfg.metric_type === "glucose"
        ? "Blood Glucose"
        : cfg.metric_type === "blood_pressure"
          ? "Blood Pressure"
          : cfg.metric_type === "weight"
            ? "Weight"
            : cfg.custom_label || "Custom";

    for (const slot of sched.slots) {
      let expectedCount = 0;
      const activeDates = new Set<string>();
      for (const dateStr of dates) {
        const dow = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();
        if (slot.daysOfWeek.includes(dow)) {
          expectedCount += 1;
          activeDates.add(dateStr);
        }
      }
      if (expectedCount === 0) continue;

      const matchedDates = new Set<string>();
      if (cfg.metric_type === "glucose") {
        const ctxLower = slot.context.toLowerCase();
        for (const r of params.glucoseRecords) {
          const d = getLocalDateString(new Date(r.measured_at), tz);
          if (!activeDates.has(d)) continue;
          const matchesFasting =
            ctxLower.includes("fasting") && r.meal_context === "fasting";
          const matchesMeal =
            (ctxLower.includes("breakfast") && r.meal_context === "breakfast") ||
            (ctxLower.includes("lunch") && r.meal_context === "lunch") ||
            (ctxLower.includes("dinner") && r.meal_context === "dinner");
          const matchesTiming =
            (!ctxLower.includes("before") && !ctxLower.includes("after")) ||
            (ctxLower.includes("before") && r.timing === "before") ||
            (ctxLower.includes("after") && r.timing === "after");
          if (matchesFasting || (matchesMeal && matchesTiming)) {
            matchedDates.add(d);
          }
        }
      } else if (cfg.metric_type === "blood_pressure") {
        for (const r of params.bpRecords) {
          const d = getLocalDateString(new Date(r.measured_at), tz);
          if (activeDates.has(d)) matchedDates.add(d);
        }
      } else if (cfg.metric_type === "weight") {
        for (const r of params.weightRecords) {
          const d = getLocalDateString(new Date(r.measured_at), tz);
          if (activeDates.has(d)) matchedDates.add(d);
        }
      } else {
        for (const r of params.customRecords) {
          if (r.metric_config_id !== cfg.id) continue;
          const d = getLocalDateString(new Date(r.measured_at), tz);
          if (activeDates.has(d)) matchedDates.add(d);
        }
      }

      const loggedCount = Math.min(matchedDates.size, expectedCount);
      slotConsistency.push({
        id: `${cfg.id}:${slot.id}`,
        metricLabel,
        context: slot.postMealMinutes
          ? `${slot.context} · ${slot.postMealMinutes}m`
          : slot.context,
        timeLabel: slot.time,
        expectedCount,
        loggedCount,
        percent: Math.round((loggedCount / expectedCount) * 100),
      });
    }
  }

  // 5. Peak / Low callouts with notes
  let highestGlucose: ReadingCallout | null = null;
  let lowestGlucose: ReadingCallout | null = null;
  if (glucoseAsc.length > 0) {
    let maxRec = glucoseAsc[0];
    let minRec = glucoseAsc[0];
    for (const r of glucoseAsc) {
      if (normalizeGlucose(r) > normalizeGlucose(maxRec)) maxRec = r;
      if (normalizeGlucose(r) < normalizeGlucose(minRec)) minRec = r;
    }
    const mapGlucose = (r: Tables<"glucose_records">, label: string): ReadingCallout => ({
      label,
      value: `${normalizeGlucose(r)} ${params.glucoseUnit}`,
      context: formatGlucoseContextLabel(
        r.meal_context as MealContext,
        r.timing as MealTiming,
        r.elapsed_minutes
      ),
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, tz),
      note: r.notes,
    });
    highestGlucose = mapGlucose(maxRec, "Highest reading");
    lowestGlucose = mapGlucose(minRec, "Lowest reading");
  }

  let highestBp: ReadingCallout | null = null;
  let lowestBp: ReadingCallout | null = null;
  if (params.bpRecords.length > 0) {
    let maxBp = params.bpRecords[0];
    let minBp = params.bpRecords[0];
    for (const r of params.bpRecords) {
      if (r.systolic > maxBp.systolic) maxBp = r;
      if (r.systolic < minBp.systolic) minBp = r;
    }
    const mapBp = (r: Tables<"blood_pressure_records">, label: string): ReadingCallout => ({
      label,
      value: `${r.systolic}/${r.diastolic} mmHg`,
      context: r.pulse ? `Pulse ${r.pulse} bpm` : "Reading",
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, tz),
      note: r.notes,
    });
    highestBp = mapBp(maxBp, "Highest systolic");
    lowestBp = mapBp(minBp, "Lowest systolic");
  }

  // Weight weekly pace
  const weightAsc = [...params.weightRecords].sort((a, b) =>
    a.measured_at.localeCompare(b.measured_at)
  );
  let weightPacePerWeek: number | null = null;
  if (weightAsc.length >= 2) {
    const first = weightAsc[0];
    const last = weightAsc[weightAsc.length - 1];
    const daysSpan =
      (new Date(last.measured_at).getTime() -
        new Date(first.measured_at).getTime()) /
      (24 * 60 * 60 * 1000);
    if (daysSpan >= 2) {
      const diff =
        convertWeightValue(Number(last.value), last.unit, params.weightUnit) -
        convertWeightValue(Number(first.value), first.unit, params.weightUnit);
      weightPacePerWeek = roundToOneDecimal((diff / daysSpan) * 7);
    }
  }

  // 6. Synthesize concrete takeaway cards
  const highlights: InsightHighlightCard[] = [];

  const postMealBuckets = mealComparison.filter(
    (b) =>
      b.key === "after_breakfast" ||
      b.key === "after_lunch" ||
      b.key === "after_dinner"
  );
  if (postMealBuckets.length >= 2) {
    const sorted = [...postMealBuckets].sort(
      (a, b) => (b.average ?? 0) - (a.average ?? 0)
    );
    const highestMeal = sorted[0];
    const lowestMeal = sorted[sorted.length - 1];
    const gap = roundToOneDecimal(
      (highestMeal.average ?? 0) - (lowestMeal.average ?? 0)
    );
    highlights.push({
      id: "meal-pattern",
      tone: "neutral",
      badge: "Meal pattern",
      title: `${highestMeal.label} runs highest among meals`,
      description: `${highestMeal.label} averaged ${highestMeal.average} ${params.glucoseUnit} (${highestMeal.count} readings) — ${gap} ${params.glucoseUnit} higher than ${lowestMeal.label} (${lowestMeal.average} ${params.glucoseUnit}).`,
      targetTab: "glucose",
    });
  }

  if (periodShifts.length > 0) {
    const primaryShift = periodShifts[0];
    if (primaryShift.delta !== null) {
      const dir =
        primaryShift.delta < 0
          ? "shifted lower"
          : primaryShift.delta > 0
            ? "shifted higher"
            : "remained steady";
      highlights.push({
        id: "period-shift",
        tone: primaryShift.delta <= 0 ? "positive" : "neutral",
        badge: "Recent shift",
        title: `${primaryShift.label} ${dir} (${formatSignedDelta(primaryShift.delta, primaryShift.unit)})`,
        description: `Averaged ${primaryShift.recentAvg} ${primaryShift.unit} in the second half of this window vs ${primaryShift.previousAvg} ${primaryShift.unit} in the first half.`,
        targetTab:
          primaryShift.label === "Systolic BP" ? "blood_pressure" : "glucose",
      });
    }
  }

  if (slotConsistency.length > 0) {
    const lowestSlot = [...slotConsistency].sort(
      (a, b) => a.percent - b.percent
    )[0];
    if (currentStreakDays > 0 || lowestSlot.percent < 100) {
      highlights.push({
        id: "consistency",
        tone: lowestSlot.percent < 75 ? "attention" : "positive",
        badge: "Routine",
        title:
          currentStreakDays > 0
            ? `${currentStreakDays}-day active tracking streak`
            : "Check-in consistency breakdown",
        description:
          lowestSlot.percent < 100
            ? `Your most commonly missed slot is ${lowestSlot.metricLabel} (${lowestSlot.context}) at ${lowestSlot.loggedCount}/${lowestSlot.expectedCount} (${lowestSlot.percent}%).`
            : "You recorded 100% of your scheduled check-ins across this period.",
        targetTab: "history",
      });
    }
  }

  const fastingBucket = mealComparison.find((b) => b.key === "fasting");
  if (
    fastingBucket &&
    fastingBucket.referenceMax !== null &&
    fastingBucket.withinTargetCount !== null
  ) {
    highlights.push({
      id: "provider-ref",
      tone:
        fastingBucket.withinTargetCount === fastingBucket.count
          ? "positive"
          : "neutral",
      badge: "Provider reference",
      title: `${fastingBucket.withinTargetCount} of ${fastingBucket.count} fasting readings within your reference`,
      description: `Measured against the ${fastingBucket.referenceMax} ${params.glucoseUnit} reference value you saved in Tracking Settings.`,
      targetTab: "glucose",
    });
  } else if (lowestGlucose?.note || highestGlucose?.note) {
    const noted = lowestGlucose?.note ? lowestGlucose : highestGlucose!;
    highlights.push({
      id: "note-callout",
      tone: "neutral",
      badge: "Logged context",
      title: `${noted.label}: ${noted.value} (${noted.context})`,
      description: `Note on ${noted.measuredAtLabel}: "${noted.note}"`,
      targetTab: "glucose",
    });
  }

  // 7. Doctor visit prep bullets
  const visitPrepBullets: string[] = [];
  if (fastingBucket) {
    visitPrepBullets.push(
      `Fasting blood glucose: ${fastingBucket.average} ${params.glucoseUnit} avg across ${fastingBucket.count} readings (range ${fastingBucket.min}–${fastingBucket.max}).`
    );
  }
  if (postMealBuckets.length > 0) {
    const summaryParts = postMealBuckets
      .map((b) => `${b.label} ${b.average}`)
      .join(", ");
    visitPrepBullets.push(
      `Post-meal averages (${params.glucoseUnit}): ${summaryParts}.`
    );
  }
  if (params.bpRecords.length > 0) {
    const bpSys = computeNumericStats(params.bpRecords.map((r) => r.systolic));
    const bpDia = computeNumericStats(params.bpRecords.map((r) => r.diastolic));
    visitPrepBullets.push(
      `Blood pressure: ${bpSys.average}/${bpDia.average} mmHg avg across ${params.bpRecords.length} readings.`
    );
  }
  if (weightAsc.length > 0) {
    const wVals = weightAsc.map((w) =>
      convertWeightValue(Number(w.value), w.unit, params.weightUnit)
    );
    const wStats = computeNumericStats(wVals);
    visitPrepBullets.push(
      `Weight: latest ${wStats.latest} ${params.weightUnit} (${
        wStats.change !== null
          ? `${formatSignedDelta(wStats.change, params.weightUnit)} across ${wStats.count} check-ins`
          : `${wStats.count} check-in`
      }).`
    );
  }

  return {
    mealComparison,
    periodShifts,
    dailyActivity,
    currentStreakDays,
    slotConsistency,
    highlights,
    glucoseCallouts: {
      highest: highestGlucose,
      lowest: lowestGlucose,
      notedCount: glucoseAsc.filter((r) => Boolean(r.notes?.trim())).length,
    },
    bpCallouts: {
      highest: highestBp,
      lowest: lowestBp,
    },
    weightPacePerWeek,
    visitPrepBullets,
    providerTargets: {
      glucose: glucoseTargets,
      bloodPressure: bpTargets,
      weight: weightTargets,
    },
    profileContext: {
      pregnancyWeek: params.pregnancyWeek,
      providerName: params.providerName,
    },
  };
}
