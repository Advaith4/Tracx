import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardMetricCard } from "@/components/dashboard/metric-summary-grid";
import type { DashboardTaskItem } from "@/components/dashboard/today-schedule-list";
import {
  getMetricDisplayName,
  getTodayScheduledTasks,
  parseSchedule,
} from "@/features/tracking-config/schedule-utils";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import {
  formatGlucoseContextLabel,
  formatLocalDateTimeLabel,
  getLocalDateString,
  resolveTodayTasksWithRecords,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import type {
  Database,
  MealContext,
  MealTiming,
  MetricType,
  RecordSource,
  Tables,
} from "@/types/database";

export interface UnifiedMeasurement {
  id: string;
  metricType: MetricType;
  metricLabel: string;
  displayValue: string;
  unit: string;
  contextLabel: string;
  measuredAt: string;
  measuredAtLabel: string;
  enteredAt: string;
  notes: string | null;
  source: RecordSource;
  rawGlucose?: Tables<"glucose_records">;
  rawBloodPressure?: Tables<"blood_pressure_records">;
  rawWeight?: Tables<"weight_records">;
  rawCustom?: Tables<"custom_metric_records">;
}

export interface DashboardPayload {
  userName: string | null;
  timezone: string;
  todayDate: string;
  metrics: DashboardMetricCard[];
  tasks: DashboardTaskItem[];
  recentMeasurements: UnifiedMeasurement[];
  dailyNote: string;
}

export async function getUnifiedMeasurements(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: {
    limit?: number;
    metricType?: MetricType;
    timezone?: string;
    configs?: Tables<"tracking_configs">[];
  }
): Promise<UnifiedMeasurement[]> {
  const limit = options?.limit ?? 30;
  const tz = safeTimezone(options?.timezone);
  const filterType = options?.metricType;

  const [glucoseRes, bpRes, weightRes, customRes, configs] = await Promise.all([
    !filterType || filterType === "glucose"
      ? supabase
          .from("glucose_records")
          .select("*")
          .eq("user_id", userId)
          .order("measured_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Tables<"glucose_records">[] }),
    !filterType || filterType === "blood_pressure"
      ? supabase
          .from("blood_pressure_records")
          .select("*")
          .eq("user_id", userId)
          .order("measured_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Tables<"blood_pressure_records">[] }),
    !filterType || filterType === "weight"
      ? supabase
          .from("weight_records")
          .select("*")
          .eq("user_id", userId)
          .order("measured_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Tables<"weight_records">[] }),
    !filterType || filterType === "custom"
      ? supabase
          .from("custom_metric_records")
          .select("*")
          .eq("user_id", userId)
          .order("measured_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Tables<"custom_metric_records">[] }),
    options?.configs
      ? Promise.resolve(options.configs)
      : ensureAndListTrackingConfigs(supabase, userId),
  ]);

  const customNameMap = new Map(
    configs
      .filter((c) => c.metric_type === "custom")
      .map((c) => [c.id, getMetricDisplayName(c)])
  );

  const items: UnifiedMeasurement[] = [];

  for (const r of glucoseRes.data ?? []) {
    items.push({
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
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, tz),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawGlucose: r,
    });
  }

  for (const r of bpRes.data ?? []) {
    items.push({
      id: r.id,
      metricType: "blood_pressure",
      metricLabel: "Blood Pressure",
      displayValue: `${r.systolic}/${r.diastolic} mmHg`,
      unit: "mmHg",
      contextLabel: r.pulse ? `Pulse ${r.pulse} bpm` : "Reading",
      measuredAt: r.measured_at,
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, tz),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawBloodPressure: r,
    });
  }

  for (const r of weightRes.data ?? []) {
    items.push({
      id: r.id,
      metricType: "weight",
      metricLabel: "Weight",
      displayValue: `${r.value} ${r.unit}`,
      unit: r.unit,
      contextLabel: "Weight check-in",
      measuredAt: r.measured_at,
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, tz),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawWeight: r,
    });
  }

  for (const r of customRes.data ?? []) {
    const val =
      r.value_numeric !== null
        ? String(r.value_numeric)
        : (r.value_text ?? "");
    items.push({
      id: r.id,
      metricType: "custom",
      metricLabel: customNameMap.get(r.metric_config_id) ?? "Custom Metric",
      displayValue: r.unit ? `${val} ${r.unit}` : val,
      unit: r.unit ?? "",
      contextLabel: "Custom record",
      measuredAt: r.measured_at,
      measuredAtLabel: formatLocalDateTimeLabel(r.measured_at, tz),
      enteredAt: r.entered_at,
      notes: r.notes,
      source: r.source,
      rawCustom: r,
    });
  }

  return items
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
    .slice(0, limit);
}

export async function getDashboardData(
  supabase: SupabaseClient<Database>,
  userId: string,
  email?: string | null
): Promise<DashboardPayload> {
  const [{ data: profile }, trackingConfigs] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, timezone")
      .eq("id", userId)
      .maybeSingle(),
    ensureAndListTrackingConfigs(supabase, userId),
  ]);

  const timezone = safeTimezone(profile?.timezone);
  const now = new Date();
  const todayDate = getLocalDateString(now, timezone);
  const twoDaysAgoIso = new Date(
    now.getTime() - 48 * 60 * 60 * 1000
  ).toISOString();

  const [
    glucoseRecentRes,
    bpRecentRes,
    weightRecentRes,
    customRecentRes,
    skipsRes,
    dailyNoteRes,
  ] = await Promise.all([
    supabase
      .from("glucose_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(20),
    supabase
      .from("blood_pressure_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(20),
    supabase
      .from("weight_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(20),
    supabase
      .from("custom_metric_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(20),
    supabase
      .from("measurement_skips")
      .select("*")
      .eq("user_id", userId)
      .eq("scheduled_date", todayDate),
    supabase
      .from("daily_notes")
      .select("content")
      .eq("user_id", userId)
      .eq("note_date", todayDate)
      .maybeSingle(),
  ]);

  const glucoseRecords = glucoseRecentRes.data ?? [];
  const bpRecords = bpRecentRes.data ?? [];
  const weightRecords = weightRecentRes.data ?? [];
  const customRecords = customRecentRes.data ?? [];
  const skips = skipsRes.data ?? [];

  const scheduledTasks = getTodayScheduledTasks(trackingConfigs, timezone, now);
  const tasks = resolveTodayTasksWithRecords({
    tasks: scheduledTasks,
    timezone,
    todayDate,
    glucoseRecords: glucoseRecords.filter(
      (r) => r.measured_at >= twoDaysAgoIso
    ),
    bpRecords: bpRecords.filter((r) => r.measured_at >= twoDaysAgoIso),
    weightRecords: weightRecords.filter((r) => r.measured_at >= twoDaysAgoIso),
    customRecords: customRecords.filter((r) => r.measured_at >= twoDaysAgoIso),
    skips,
  });

  const metricCards: DashboardMetricCard[] = trackingConfigs
    .filter((config) => config.enabled && config.show_on_dashboard)
    .map((config) => {
      const schedule = parseSchedule(config.schedule);
      const label = getMetricDisplayName(config);

      if (config.metric_type === "glucose") {
        const latest = glucoseRecords[0];
        const todayCount = glucoseRecords.filter(
          (r) => getLocalDateString(new Date(r.measured_at), timezone) === todayDate
        ).length;
        return {
          id: config.id,
          metricType: "glucose",
          label,
          latestValue: latest ? String(latest.value) : "--",
          unit: latest ? latest.unit : config.unit,
          context: latest
            ? formatGlucoseContextLabel(
                latest.meal_context,
                latest.timing,
                latest.elapsed_minutes
              )
            : schedule.contexts.slice(0, 2).join(" · ") || "Flexible",
          subtitle: latest
            ? `${todayCount} today · ${formatLocalDateTimeLabel(latest.measured_at, timezone, now)}`
            : "No readings logged yet",
        };
      }

      if (config.metric_type === "blood_pressure") {
        const latest = bpRecords[0];
        const todayCount = bpRecords.filter(
          (r) => getLocalDateString(new Date(r.measured_at), timezone) === todayDate
        ).length;
        return {
          id: config.id,
          metricType: "blood_pressure",
          label,
          latestValue: latest ? `${latest.systolic}/${latest.diastolic}` : "--",
          unit: config.unit,
          context: latest?.pulse
            ? `Pulse ${latest.pulse} bpm`
            : latest
              ? "Latest reading"
              : schedule.contexts.slice(0, 2).join(" · ") || "Flexible",
          subtitle: latest
            ? `${todayCount} today · ${formatLocalDateTimeLabel(latest.measured_at, timezone, now)}`
            : "No readings logged yet",
        };
      }

      if (config.metric_type === "weight") {
        const latest = weightRecords[0];
        return {
          id: config.id,
          metricType: "weight",
          label,
          latestValue: latest ? String(latest.value) : "--",
          unit: latest ? latest.unit : config.unit,
          context: latest ? "Latest record" : "Morning check-in",
          subtitle: latest
            ? formatLocalDateTimeLabel(latest.measured_at, timezone, now)
            : "No readings logged yet",
        };
      }

      const latestCustom = customRecords.find(
        (r) => r.metric_config_id === config.id
      );
      const customVal = latestCustom
        ? latestCustom.value_numeric !== null
          ? String(latestCustom.value_numeric)
          : (latestCustom.value_text ?? "--")
        : "--";

      return {
        id: config.id,
        metricType: "custom",
        label,
        latestValue: customVal,
        unit: latestCustom?.unit ?? config.unit,
        context: latestCustom ? "Latest record" : "Custom metric",
        subtitle: latestCustom
          ? formatLocalDateTimeLabel(latestCustom.measured_at, timezone, now)
          : "No readings logged yet",
      };
    });

  const recentMeasurements = await getUnifiedMeasurements(supabase, userId, {
    limit: 6,
    timezone,
    configs: trackingConfigs,
  });

  const fallbackName = email?.split("@")[0] ?? null;

  return {
    userName: profile?.display_name ?? fallbackName,
    timezone,
    todayDate,
    metrics: metricCards,
    tasks,
    recentMeasurements,
    dailyNote: dailyNoteRes.data?.content ?? "",
  };
}
