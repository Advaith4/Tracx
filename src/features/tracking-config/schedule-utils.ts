import type { MeasurementStatus } from "@/components/layout/status-badge";
import type { Json, Tables } from "@/types/database";
import {
  providerTargetsSchema,
  trackingScheduleSchema,
  type ProviderTargets,
  type TrackingScheduleConfig,
} from "./schemas";

export interface TodayScheduledTask {
  id: string;
  configId: string;
  metricType: Tables<"tracking_configs">["metric_type"];
  measurementName: string;
  context: string;
  scheduledTime: string;
  rawTime: string;
  status: MeasurementStatus;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function parseSchedule(raw: Json | null | undefined): TrackingScheduleConfig {
  const parsed = trackingScheduleSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { contexts: [], slots: [] };
  }
  return parsed.data;
}

export function parseProviderTargets(
  raw: Json | null | undefined
): ProviderTargets | null {
  if (!raw) return null;
  const parsed = providerTargetsSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data ?? null;
}

export function getMetricDisplayName(
  config: Pick<Tables<"tracking_configs">, "metric_type" | "custom_label">
): string {
  switch (config.metric_type) {
    case "glucose":
      return "Blood Glucose";
    case "blood_pressure":
      return "Blood Pressure";
    case "weight":
      return "Weight";
    case "custom":
      return config.custom_label?.trim() || "Custom Measurement";
  }
}

export function formatTime12h(hhmm: string): string {
  const [hourStr, minStr] = hhmm.split(":");
  const hour = Number(hourStr);
  const minute = Number(minStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return hhmm;
  }
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function getLocalDayAndTime(timezone: string, referenceDate: Date) {
  let validTimezone = timezone || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: validTimezone }).format(
      referenceDate
    );
  } catch {
    validTimezone = "UTC";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: validTimezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(referenceDate);

  const weekdayStr =
    parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "00";

  // Intl hour12:false can emit "24" for midnight in some locales.
  const normalizedHour = hourStr === "24" ? "00" : hourStr;

  return {
    dayOfWeek: WEEKDAY_INDEX[weekdayStr] ?? 0,
    hhmm: `${normalizedHour}:${minuteStr}`,
  };
}

export function getTodayScheduledTasks(
  configs: Tables<"tracking_configs">[],
  timezone = "UTC",
  referenceDate = new Date()
): TodayScheduledTask[] {
  const { dayOfWeek, hhmm } = getLocalDayAndTime(timezone, referenceDate);
  const tasks: TodayScheduledTask[] = [];

  for (const config of configs) {
    if (!config.enabled || !config.show_on_dashboard) {
      continue;
    }

    const schedule = parseSchedule(config.schedule);
    const measurementName = getMetricDisplayName(config);

    for (const slot of schedule.slots) {
      if (!slot.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }

      const contextLabel = slot.postMealMinutes
        ? `${slot.context} · ${slot.postMealMinutes}m`
        : slot.context;

      tasks.push({
        id: `${config.id}:${slot.id}`,
        configId: config.id,
        metricType: config.metric_type,
        measurementName,
        context: contextLabel,
        scheduledTime: formatTime12h(slot.time),
        rawTime: slot.time,
        status: slot.time > hhmm ? "upcoming" : "pending",
      });
    }
  }

  return tasks.sort((a, b) => a.rawTime.localeCompare(b.rawTime));
}
