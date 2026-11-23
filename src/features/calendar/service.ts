import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardTaskItem } from "@/components/dashboard/today-schedule-list";
import {
  formatTime12h,
  getMetricDisplayName,
  parseProviderTargets,
  parseSchedule,
  type TodayScheduledTask,
} from "@/features/tracking-config/schedule-utils";
import type { ProviderTargets } from "@/features/tracking-config/schemas";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import {
  computeNumericStats,
  convertGlucoseValue,
  convertWeightValue,
  roundToOneDecimal,
} from "@/lib/calculations/analytics";
import {
  formatGlucoseContextLabel,
  getLocalDateString,
  getLocalHHMM,
  resolveTodayTasksWithRecords,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import {
  getWeekdayFromDateString,
  parseReminderMetricMeta,
  type ReminderCategory,
} from "@/lib/notifications/reminder-logic";
import type {
  Database,
  GlucoseUnit,
  MealContext,
  MealTiming,
  MetricType,
  RecordSource,
  Tables,
  WeightUnit,
} from "@/types/database";

export interface CalendarDayEntry {
  id: string;
  metricType: MetricType;
  metricLabel: string;
  displayValue: string;
  contextLabel: string;
  timeLabel: string;
  rawTime: string;
  measuredAt: string;
  notes: string | null;
  source: RecordSource;
}

export interface CalendarDayReminder {
  id: string;
  label: string;
  category: ReminderCategory;
  isDateSpecific: boolean;
  scheduledDate: string | null;
  scheduledTime: string;
  timeLabel: string;
  channel: Tables<"reminders">["channel"];
  enabled: boolean;
  daysOfWeek: number[];
  followUpMinutes: number | null;
  snoozeMinutes: number;
  notificationStatus: "sent" | "failed" | "snoozed" | null;
}

export interface CalendarDayStats {
  date: string;
  weekday: number;
  isToday: boolean;
  isFuture: boolean;
  totalLogs: number;
  scheduledCount: number;
  completedScheduledCount: number;
  glucose: {
    count: number;
    average: number | null;
    min: number | null;
    max: number | null;
    fastingAverage: number | null;
    postMealAverage: number | null;
    outOfTargetCount: number;
  };
  bloodPressure: {
    count: number;
    avgSystolic: number | null;
    avgDiastolic: number | null;
    maxSystolic: number | null;
    maxDiastolic: number | null;
    avgPulse: number | null;
    outOfTargetCount: number;
  };
  weight: {
    count: number;
    latest: number | null;
    changeFromPrevious: number | null;
  };
  customMetrics: Array<{
    label: string;
    count: number;
    summaryValues: string[];
  }>;
  tasks: DashboardTaskItem[];
  entries: CalendarDayEntry[];
  skips: Array<{
    id: string;
    metricType: string;
    contextLabel: string | null;
    reason: string | null;
  }>;
  dailyNote: string;
  reminders: CalendarDayReminder[];
}

export interface CalendarMonthPayload {
  month: string;
  timezone: string;
  todayDate: string;
  daysInMonth: number;
  firstWeekdayOfMonth: number;
  units: {
    glucose: GlucoseUnit;
    weight: WeightUnit;
  };
  providerTargets: {
    glucose: ProviderTargets | null;
    bloodPressure: ProviderTargets | null;
  };
  hasPushSubscription: boolean;
  allReminders: Array<{
    id: string;
    label: string;
    category: ReminderCategory;
    scheduledDate: string | null;
    scheduledTime: string;
    timeLabel: string;
    channel: Tables<"reminders">["channel"];
    enabled: boolean;
    daysOfWeek: number[];
    followUpMinutes: number | null;
    snoozeMinutes: number;
  }>;
  days: Record<string, CalendarDayStats>;
}

const MONTH_REGEX = /^\d{4}-\d{2}$/;

function shiftDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function getScheduledTasksForWeekday(
  configs: Tables<"tracking_configs">[],
  weekday: number,
  isToday: boolean,
  isFuture: boolean,
  currentHHMM: string
): TodayScheduledTask[] {
  const tasks: TodayScheduledTask[] = [];
  const seenKeys = new Set<string>();

  for (const config of configs) {
    if (!config.enabled || !config.show_on_dashboard) continue;
    const schedule = parseSchedule(config.schedule);
    const measurementName = getMetricDisplayName(config);

    for (const slot of schedule.slots) {
      if (!slot.daysOfWeek.includes(weekday)) continue;
      const contextLabel = slot.postMealMinutes
        ? `${slot.context} · ${slot.postMealMinutes}m`
        : slot.context;
      const dedupeKey = `${config.metric_type}:${measurementName}:${contextLabel}:${slot.time}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const defaultStatus = isFuture
        ? "upcoming"
        : isToday && slot.time > currentHHMM
          ? "upcoming"
          : "pending";

      tasks.push({
        id: `${config.id}:${slot.id}`,
        configId: config.id,
        metricType: config.metric_type,
        measurementName,
        context: contextLabel,
        scheduledTime: formatTime12h(slot.time),
        rawTime: slot.time,
        status: defaultStatus,
      });
    }
  }

  return tasks.sort((a, b) => a.rawTime.localeCompare(b.rawTime));
}

export async function getCalendarMonthData(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: { month?: string }
): Promise<CalendarMonthPayload> {
  const now = new Date();
  const [profileRes, configs] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle(),
    ensureAndListTrackingConfigs(supabase, userId),
  ]);

  const timezone = safeTimezone(profileRes.data?.timezone);
  const todayDate = getLocalDateString(now, timezone);
  const currentHHMM = getLocalHHMM(now, timezone);

  const requestedMonth = options?.month?.trim();
  const month =
    requestedMonth && MONTH_REGEX.test(requestedMonth)
      ? requestedMonth
      : todayDate.slice(0, 7);

  const [yearNum, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
  const monthStartDate = `${month}-01`;
  const monthEndDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const firstWeekdayOfMonth = getWeekdayFromDateString(monthStartDate);

  const windowStartIso = `${shiftDateString(monthStartDate, -1)}T00:00:00.000Z`;
  const windowEndIso = `${shiftDateString(monthEndDate, 1)}T23:59:59.999Z`;

  const glucoseConfig = configs.find((c) => c.metric_type === "glucose");
  const bpConfig = configs.find((c) => c.metric_type === "blood_pressure");
  const weightConfig = configs.find((c) => c.metric_type === "weight");

  const glucoseUnit: GlucoseUnit =
    glucoseConfig?.unit === "mmol/L" ? "mmol/L" : "mg/dL";
  const weightUnit: WeightUnit = weightConfig?.unit === "lb" ? "lb" : "kg";

  const glucoseTargets = parseProviderTargets(glucoseConfig?.provider_targets);
  const bpTargets = parseProviderTargets(bpConfig?.provider_targets);

  const [
    glucoseRes,
    bpRes,
    weightRes,
    prevWeightRes,
    customRes,
    skipsRes,
    notesRes,
    remindersRes,
    logsRes,
    pushSubsRes,
  ] = await Promise.all([
    supabase
      .from("glucose_records")
      .select("*")
      .eq("user_id", userId)
      .gte("measured_at", windowStartIso)
      .lte("measured_at", windowEndIso)
      .order("measured_at", { ascending: true }),
    supabase
      .from("blood_pressure_records")
      .select("*")
      .eq("user_id", userId)
      .gte("measured_at", windowStartIso)
      .lte("measured_at", windowEndIso)
      .order("measured_at", { ascending: true }),
    supabase
      .from("weight_records")
      .select("*")
      .eq("user_id", userId)
      .gte("measured_at", windowStartIso)
      .lte("measured_at", windowEndIso)
      .order("measured_at", { ascending: true }),
    supabase
      .from("weight_records")
      .select("value, unit, measured_at")
      .eq("user_id", userId)
      .lt("measured_at", windowStartIso)
      .order("measured_at", { ascending: false })
      .limit(1),
    supabase
      .from("custom_metric_records")
      .select("*")
      .eq("user_id", userId)
      .gte("measured_at", windowStartIso)
      .lte("measured_at", windowEndIso)
      .order("measured_at", { ascending: true }),
    supabase
      .from("measurement_skips")
      .select("*")
      .eq("user_id", userId)
      .gte("scheduled_date", monthStartDate)
      .lte("scheduled_date", monthEndDate),
    supabase
      .from("daily_notes")
      .select("*")
      .eq("user_id", userId)
      .gte("note_date", monthStartDate)
      .lte("note_date", monthEndDate),
    supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_time", { ascending: true }),
    supabase
      .from("notification_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("scheduled_for", windowStartIso)
      .lte("scheduled_for", windowEndIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .limit(1),
  ]);

  const customNameMap = new Map(
    configs
      .filter((c) => c.metric_type === "custom")
      .map((c) => [c.id, getMetricDisplayName(c)])
  );

  const noteByDate = new Map(
    (notesRes.data ?? []).map((n) => [n.note_date, n.content])
  );

  const glucoseByDate = new Map<string, Tables<"glucose_records">[]>();
  for (const r of glucoseRes.data ?? []) {
    const d = getLocalDateString(new Date(r.measured_at), timezone);
    if (d < monthStartDate || d > monthEndDate) continue;
    const list = glucoseByDate.get(d) ?? [];
    list.push(r);
    glucoseByDate.set(d, list);
  }

  const bpByDate = new Map<string, Tables<"blood_pressure_records">[]>();
  for (const r of bpRes.data ?? []) {
    const d = getLocalDateString(new Date(r.measured_at), timezone);
    if (d < monthStartDate || d > monthEndDate) continue;
    const list = bpByDate.get(d) ?? [];
    list.push(r);
    bpByDate.set(d, list);
  }

  const weightByDate = new Map<string, Tables<"weight_records">[]>();
  for (const r of weightRes.data ?? []) {
    const d = getLocalDateString(new Date(r.measured_at), timezone);
    if (d < monthStartDate || d > monthEndDate) continue;
    const list = weightByDate.get(d) ?? [];
    list.push(r);
    weightByDate.set(d, list);
  }

  const customByDate = new Map<string, Tables<"custom_metric_records">[]>();
  for (const r of customRes.data ?? []) {
    const d = getLocalDateString(new Date(r.measured_at), timezone);
    if (d < monthStartDate || d > monthEndDate) continue;
    const list = customByDate.get(d) ?? [];
    list.push(r);
    customByDate.set(d, list);
  }

  const skipsByDate = new Map<string, Tables<"measurement_skips">[]>();
  for (const s of skipsRes.data ?? []) {
    const list = skipsByDate.get(s.scheduled_date) ?? [];
    list.push(s);
    skipsByDate.set(s.scheduled_date, list);
  }

  const logStatusByDayAndReminder = new Map<
    string,
    "sent" | "failed" | "snoozed"
  >();
  for (const log of logsRes.data ?? []) {
    if (!log.reminder_id) continue;
    const d = getLocalDateString(new Date(log.scheduled_for), timezone);
    const key = `${d}:${log.reminder_id}`;
    if (logStatusByDayAndReminder.has(key)) continue;
    if (log.status === "sent") {
      logStatusByDayAndReminder.set(key, "sent");
    } else if (log.status === "failed") {
      logStatusByDayAndReminder.set(key, "failed");
    } else if (
      log.status === "skipped" &&
      log.error_message?.includes("Snoozed")
    ) {
      logStatusByDayAndReminder.set(key, "snoozed");
    }
  }

  let runningPreviousWeight: number | null = prevWeightRes.data?.[0]
    ? roundToOneDecimal(
        convertWeightValue(
          Number(prevWeightRes.data[0].value),
          prevWeightRes.data[0].unit as WeightUnit,
          weightUnit
        )
      )
    : null;

  const parsedReminders = (remindersRes.data ?? []).map((rem) => {
    const meta = parseReminderMetricMeta(rem.metric_type);
    return {
      id: rem.id,
      label: rem.label,
      category: meta.category,
      scheduledDate: meta.scheduledDate,
      scheduledTime: rem.scheduled_time.slice(0, 5),
      timeLabel: formatTime12h(rem.scheduled_time.slice(0, 5)),
      channel: rem.channel,
      enabled: rem.enabled,
      daysOfWeek: rem.days_of_week,
      followUpMinutes: rem.follow_up_minutes,
      snoozeMinutes: rem.snooze_minutes,
    };
  });

  const days: Record<string, CalendarDayStats> = {};

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = `${month}-${String(dayNum).padStart(2, "0")}`;
    const weekday = getWeekdayFromDateString(dateStr);
    const isToday = dateStr === todayDate;
    const isFuture = dateStr > todayDate;

    const dayGlucose = glucoseByDate.get(dateStr) ?? [];
    const dayBp = bpByDate.get(dateStr) ?? [];
    const dayWeight = weightByDate.get(dateStr) ?? [];
    const dayCustom = customByDate.get(dateStr) ?? [];
    const daySkips = skipsByDate.get(dateStr) ?? [];

    // Glucose daily stats
    const gValues = dayGlucose.map((r) =>
      roundToOneDecimal(
        convertGlucoseValue(Number(r.value), r.unit as GlucoseUnit, glucoseUnit)
      )
    );
    const gFasting = dayGlucose
      .filter((r) => r.meal_context === "fasting")
      .map((r) =>
        roundToOneDecimal(
          convertGlucoseValue(
            Number(r.value),
            r.unit as GlucoseUnit,
            glucoseUnit
          )
        )
      );
    const gPostMeal = dayGlucose
      .filter((r) => r.timing === "after")
      .map((r) =>
        roundToOneDecimal(
          convertGlucoseValue(
            Number(r.value),
            r.unit as GlucoseUnit,
            glucoseUnit
          )
        )
      );
    const gStats = computeNumericStats(gValues);
    const fastingStats = computeNumericStats(gFasting);
    const postMealStats = computeNumericStats(gPostMeal);

    let gOutOfTargetCount = 0;
    if (glucoseTargets) {
      for (const r of dayGlucose) {
        const val = roundToOneDecimal(
          convertGlucoseValue(
            Number(r.value),
            r.unit as GlucoseUnit,
            glucoseUnit
          )
        );
        const ceiling =
          r.meal_context === "fasting"
            ? (glucoseTargets.fastingMax ?? glucoseTargets.targetMax ?? null)
            : r.timing === "after"
              ? (glucoseTargets.postMealMax ?? glucoseTargets.targetMax ?? null)
              : (glucoseTargets.targetMax ?? null);
        if (ceiling !== null && ceiling !== undefined && val > ceiling) {
          gOutOfTargetCount += 1;
        }
      }
    }

    // Blood pressure daily stats
    const sysVals = dayBp.map((r) => r.systolic);
    const diaVals = dayBp.map((r) => r.diastolic);
    const pulseVals = dayBp
      .filter((r) => r.pulse !== null)
      .map((r) => r.pulse as number);
    const sysStats = computeNumericStats(sysVals);
    const diaStats = computeNumericStats(diaVals);
    const pulseStats = computeNumericStats(pulseVals);

    let bpOutOfTargetCount = 0;
    if (bpTargets) {
      for (const r of dayBp) {
        const overSys =
          bpTargets.systolicMax !== null &&
          bpTargets.systolicMax !== undefined &&
          r.systolic > bpTargets.systolicMax;
        const overDia =
          bpTargets.diastolicMax !== null &&
          bpTargets.diastolicMax !== undefined &&
          r.diastolic > bpTargets.diastolicMax;
        if (overSys || overDia) bpOutOfTargetCount += 1;
      }
    }

    // Weight daily stats
    const wValues = dayWeight.map((r) =>
      roundToOneDecimal(
        convertWeightValue(Number(r.value), r.unit as WeightUnit, weightUnit)
      )
    );
    const latestWeight =
      wValues.length > 0 ? wValues[wValues.length - 1] : null;
    const changeFromPrevious =
      latestWeight !== null && runningPreviousWeight !== null
        ? roundToOneDecimal(latestWeight - runningPreviousWeight)
        : null;
    if (latestWeight !== null) {
      runningPreviousWeight = latestWeight;
    }

    // Custom metric summary
    const customGroupMap = new Map<string, string[]>();
    for (const r of dayCustom) {
      const label = customNameMap.get(r.metric_config_id) ?? "Custom";
      const valStr =
        r.value_numeric !== null
          ? `${r.value_numeric}${r.unit ? ` ${r.unit}` : ""}`
          : (r.value_text ?? "Logged");
      const list = customGroupMap.get(label) ?? [];
      list.push(valStr);
      customGroupMap.set(label, list);
    }

    // Routine scheduled tasks for this date
    const baseTasks = getScheduledTasksForWeekday(
      configs,
      weekday,
      isToday,
      isFuture,
      currentHHMM
    );
    const resolvedTasks = resolveTodayTasksWithRecords({
      tasks: baseTasks,
      timezone,
      todayDate: dateStr,
      glucoseRecords: dayGlucose,
      bpRecords: dayBp,
      weightRecords: dayWeight,
      customRecords: dayCustom,
      skips: daySkips,
    });
    const completedScheduledCount = resolvedTasks.filter(
      (t) =>
        t.status === "recorded" ||
        t.status === "late" ||
        t.status === "skipped"
    ).length;

    // Chronological measurement entries for this date
    const entries: CalendarDayEntry[] = [];
    for (const r of dayGlucose) {
      const rawTime = getLocalHHMM(new Date(r.measured_at), timezone);
      entries.push({
        id: r.id,
        metricType: "glucose",
        metricLabel: "Blood Glucose",
        displayValue: `${roundToOneDecimal(convertGlucoseValue(Number(r.value), r.unit as GlucoseUnit, glucoseUnit))} ${glucoseUnit}`,
        contextLabel: formatGlucoseContextLabel(
          r.meal_context as MealContext,
          r.timing as MealTiming,
          r.elapsed_minutes
        ),
        timeLabel: formatTime12h(rawTime),
        rawTime,
        measuredAt: r.measured_at,
        notes: r.notes,
        source: r.source,
      });
    }
    for (const r of dayBp) {
      const rawTime = getLocalHHMM(new Date(r.measured_at), timezone);
      entries.push({
        id: r.id,
        metricType: "blood_pressure",
        metricLabel: "Blood Pressure",
        displayValue: `${r.systolic}/${r.diastolic} mmHg`,
        contextLabel: r.pulse ? `Pulse ${r.pulse} bpm` : "Reading",
        timeLabel: formatTime12h(rawTime),
        rawTime,
        measuredAt: r.measured_at,
        notes: r.notes,
        source: r.source,
      });
    }
    for (const r of dayWeight) {
      const rawTime = getLocalHHMM(new Date(r.measured_at), timezone);
      entries.push({
        id: r.id,
        metricType: "weight",
        metricLabel: "Weight",
        displayValue: `${roundToOneDecimal(convertWeightValue(Number(r.value), r.unit as WeightUnit, weightUnit))} ${weightUnit}`,
        contextLabel: "Weight check-in",
        timeLabel: formatTime12h(rawTime),
        rawTime,
        measuredAt: r.measured_at,
        notes: r.notes,
        source: r.source,
      });
    }
    for (const r of dayCustom) {
      const rawTime = getLocalHHMM(new Date(r.measured_at), timezone);
      const val =
        r.value_numeric !== null
          ? String(r.value_numeric)
          : (r.value_text ?? "");
      entries.push({
        id: r.id,
        metricType: "custom",
        metricLabel: customNameMap.get(r.metric_config_id) ?? "Custom",
        displayValue: r.unit ? `${val} ${r.unit}` : val,
        contextLabel: "Custom log",
        timeLabel: formatTime12h(rawTime),
        rawTime,
        measuredAt: r.measured_at,
        notes: r.notes,
        source: r.source,
      });
    }
    entries.sort((a, b) => a.rawTime.localeCompare(b.rawTime));

    // Reminders active on this exact date
    const dayReminders: CalendarDayReminder[] = parsedReminders
      .filter((rem) =>
        rem.scheduledDate
          ? rem.scheduledDate === dateStr
          : rem.daysOfWeek.includes(weekday)
      )
      .map((rem) => ({
        ...rem,
        isDateSpecific: Boolean(rem.scheduledDate),
        notificationStatus:
          logStatusByDayAndReminder.get(`${dateStr}:${rem.id}`) ?? null,
      }))
      .sort((a, b) => {
        if (a.isDateSpecific !== b.isDateSpecific) {
          return a.isDateSpecific ? -1 : 1;
        }
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });

    days[dateStr] = {
      date: dateStr,
      weekday,
      isToday,
      isFuture,
      totalLogs: entries.length,
      scheduledCount: resolvedTasks.length,
      completedScheduledCount,
      glucose: {
        count: gStats.count,
        average: gStats.average,
        min: gStats.min,
        max: gStats.max,
        fastingAverage: fastingStats.average,
        postMealAverage: postMealStats.average,
        outOfTargetCount: gOutOfTargetCount,
      },
      bloodPressure: {
        count: dayBp.length,
        avgSystolic: sysStats.average,
        avgDiastolic: diaStats.average,
        maxSystolic: sysStats.max,
        maxDiastolic: diaStats.max,
        avgPulse: pulseStats.average,
        outOfTargetCount: bpOutOfTargetCount,
      },
      weight: {
        count: wValues.length,
        latest: latestWeight,
        changeFromPrevious,
      },
      customMetrics: [...customGroupMap.entries()].map(
        ([label, summaryValues]) => ({
          label,
          count: summaryValues.length,
          summaryValues,
        })
      ),
      tasks: resolvedTasks,
      entries,
      skips: daySkips.map((s) => ({
        id: s.id,
        metricType: s.metric_type,
        contextLabel: s.context_label,
        reason: s.reason,
      })),
      dailyNote: noteByDate.get(dateStr) ?? "",
      reminders: dayReminders,
    };
  }

  return {
    month,
    timezone,
    todayDate,
    daysInMonth,
    firstWeekdayOfMonth,
    units: {
      glucose: glucoseUnit,
      weight: weightUnit,
    },
    providerTargets: {
      glucose: glucoseTargets,
      bloodPressure: bpTargets,
    },
    hasPushSubscription: (pushSubsRes.data ?? []).length > 0,
    allReminders: parsedReminders,
    days,
  };
}
