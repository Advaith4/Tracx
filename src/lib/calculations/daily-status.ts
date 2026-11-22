import type { DashboardTaskItem } from "@/components/dashboard/today-schedule-list";
import type { TodayScheduledTask } from "@/features/tracking-config/schedule-utils";
import type { MealContext, MealTiming, Tables } from "@/types/database";

export function safeTimezone(timezone?: string | null): string {
  const candidate = timezone || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

export function getLocalDateString(
  date: Date,
  timezone = "UTC"
): string {
  const tz = safeTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getLocalHHMM(date: Date, timezone = "UTC"): string {
  const tz = safeTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
}

export function formatLocalDateTimeLabel(
  isoString: string,
  timezone = "UTC",
  referenceDate = new Date()
): string {
  const tz = safeTimezone(timezone);
  const date = new Date(isoString);
  const dateStr = getLocalDateString(date, tz);
  const todayStr = getLocalDateString(referenceDate, tz);
  const yesterday = new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday, tz);

  const timeFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (dateStr === todayStr) return `Today, ${timeFormatted}`;
  if (dateStr === yesterdayStr) return `Yesterday, ${timeFormatted}`;

  const dayFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  }).format(date);

  return `${dayFormatted}, ${timeFormatted}`;
}

export function formatGlucoseContextLabel(
  mealContext: MealContext,
  timing: MealTiming,
  elapsedMinutes?: number | null
): string {
  if (mealContext === "fasting") return "Fasting";
  if (mealContext === "unknown") return "General";

  const mealName =
    mealContext.charAt(0).toUpperCase() + mealContext.slice(1);
  const timingPrefix =
    timing === "before" ? "Before " : timing === "after" ? "After " : "";
  const base = `${timingPrefix}${mealName.toLowerCase()}`;
  const formattedBase = base.charAt(0).toUpperCase() + base.slice(1);

  if (timing === "after" && elapsedMinutes) {
    return `${formattedBase} · ${elapsedMinutes}m`;
  }
  return formattedBase;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function slotContextMatchesGlucose(
  slotContext: string,
  record: Tables<"glucose_records">
): boolean {
  const normalized = slotContext.toLowerCase();

  if (normalized.includes("fasting")) {
    return record.meal_context === "fasting";
  }

  const mealKeywords: Array<Exclude<MealContext, "fasting" | "unknown">> = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
  ];
  const matchedMeal = mealKeywords.find((meal) => normalized.includes(meal));
  if (matchedMeal && record.meal_context !== matchedMeal) {
    return false;
  }

  if (normalized.includes("before") && record.timing !== "before") {
    return false;
  }
  if (normalized.includes("after") && record.timing !== "after") {
    return false;
  }

  return Boolean(matchedMeal) || normalized === "general";
}

export function resolveTodayTasksWithRecords(params: {
  tasks: TodayScheduledTask[];
  timezone: string;
  todayDate: string;
  glucoseRecords: Tables<"glucose_records">[];
  bpRecords: Tables<"blood_pressure_records">[];
  weightRecords: Tables<"weight_records">[];
  customRecords: Tables<"custom_metric_records">[];
  skips: Tables<"measurement_skips">[];
}): DashboardTaskItem[] {
  const {
    tasks,
    timezone,
    todayDate,
    glucoseRecords,
    bpRecords,
    weightRecords,
    customRecords,
    skips,
  } = params;

  const todayGlucose = glucoseRecords.filter(
    (r) => getLocalDateString(new Date(r.measured_at), timezone) === todayDate
  );
  const todayBp = bpRecords.filter(
    (r) => getLocalDateString(new Date(r.measured_at), timezone) === todayDate
  );
  const todayWeight = weightRecords.filter(
    (r) => getLocalDateString(new Date(r.measured_at), timezone) === todayDate
  );
  const todayCustom = customRecords.filter(
    (r) => getLocalDateString(new Date(r.measured_at), timezone) === todayDate
  );
  const todaySkips = skips.filter((s) => s.scheduled_date === todayDate);

  const usedGlucoseIds = new Set<string>();
  const usedBpIds = new Set<string>();
  const usedWeightIds = new Set<string>();
  const usedCustomIds = new Set<string>();

  return tasks.map((task): DashboardTaskItem => {
    const matchedSkip = todaySkips.find(
      (s) =>
        s.metric_type === task.metricType &&
        (!s.tracking_config_id || s.tracking_config_id === task.configId) &&
        (!s.context_label ||
          s.context_label.toLowerCase() === task.context.toLowerCase())
    );

    if (matchedSkip) {
      return { ...task, status: "skipped" };
    }

    let matchedMeasuredAt: string | null = null;
    let recordedValue: string | undefined;

    if (task.metricType === "glucose") {
      const match = todayGlucose.find(
        (r) =>
          !usedGlucoseIds.has(r.id) &&
          slotContextMatchesGlucose(task.context, r)
      );
      if (match) {
        usedGlucoseIds.add(match.id);
        matchedMeasuredAt = match.measured_at;
        recordedValue = `${match.value} ${match.unit}`;
      }
    } else if (task.metricType === "blood_pressure") {
      const match = todayBp.find((r) => !usedBpIds.has(r.id));
      if (match) {
        usedBpIds.add(match.id);
        matchedMeasuredAt = match.measured_at;
        recordedValue = `${match.systolic}/${match.diastolic} mmHg`;
      }
    } else if (task.metricType === "weight") {
      const match = todayWeight.find((r) => !usedWeightIds.has(r.id));
      if (match) {
        usedWeightIds.add(match.id);
        matchedMeasuredAt = match.measured_at;
        recordedValue = `${match.value} ${match.unit}`;
      }
    } else if (task.metricType === "custom") {
      const match = todayCustom.find(
        (r) =>
          !usedCustomIds.has(r.id) && r.metric_config_id === task.configId
      );
      if (match) {
        usedCustomIds.add(match.id);
        matchedMeasuredAt = match.measured_at;
        const val =
          match.value_numeric !== null
            ? String(match.value_numeric)
            : (match.value_text ?? "");
        recordedValue = match.unit ? `${val} ${match.unit}` : val;
      }
    }

    if (matchedMeasuredAt) {
      const measuredHHMM = getLocalHHMM(new Date(matchedMeasuredAt), timezone);
      const diffMinutes =
        hhmmToMinutes(measuredHHMM) - hhmmToMinutes(task.rawTime);
      return {
        ...task,
        status: diffMinutes > 60 ? "late" : "recorded",
        recordedValue,
      };
    }

    return task;
  });
}
