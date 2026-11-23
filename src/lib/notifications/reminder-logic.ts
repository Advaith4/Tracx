import {
  getLocalDateString,
  getLocalHHMM,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import type { Tables } from "@/types/database";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isTimeInQuietHours(
  currentHHMM: string,
  quietStart: string | null | undefined,
  quietEnd: string | null | undefined
): boolean {
  if (!quietStart || !quietEnd) return false;
  const current = hhmmToMinutes(currentHHMM);
  const start = hhmmToMinutes(quietStart.slice(0, 5));
  const end = hhmmToMinutes(quietEnd.slice(0, 5));

  if (start === end) return false;
  if (start < end) {
    return current >= start && current < end;
  }
  // Overnight quiet hours (e.g. 22:00 -> 07:00)
  return current >= start || current < end;
}

export function getLocalWeekday(date: Date, timezone: string): number {
  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    weekday: "short",
  }).format(date);
  return WEEKDAY_INDEX[weekdayStr] ?? 0;
}

export function buildPrivacySafeNotificationCopy(
  reminder: Pick<Tables<"reminders">, "label">,
  includeDetails = false
): { title: string; body: string } {
  if (!includeDetails) {
    return {
      title: "Tracx Check-in",
      body: "Your scheduled health check-in is due.",
    };
  }
  return {
    title: "Tracx Reminder",
    body: `Scheduled check-in: ${reminder.label}`,
  };
}

export function evaluateReminderDueState(params: {
  reminder: Tables<"reminders">;
  referenceDate: Date;
  completedMetricTypesToday: Set<string>;
  todayLogsForReminder: Tables<"notification_logs">[];
}): {
  shouldSendInitial: boolean;
  shouldSendFollowUp: boolean;
  reason: string;
} {
  const {
    reminder,
    referenceDate,
    completedMetricTypesToday,
    todayLogsForReminder,
  } = params;

  if (!reminder.enabled) {
    return {
      shouldSendInitial: false,
      shouldSendFollowUp: false,
      reason: "disabled",
    };
  }

  const tz = safeTimezone(reminder.timezone);
  const weekday = getLocalWeekday(referenceDate, tz);
  if (!reminder.days_of_week.includes(weekday)) {
    return {
      shouldSendInitial: false,
      shouldSendFollowUp: false,
      reason: "not_scheduled_today",
    };
  }

  const nowHHMM = getLocalHHMM(referenceDate, tz);
  if (
    isTimeInQuietHours(
      nowHHMM,
      reminder.quiet_hours_start,
      reminder.quiet_hours_end
    )
  ) {
    return {
      shouldSendInitial: false,
      shouldSendFollowUp: false,
      reason: "quiet_hours",
    };
  }

  if (completedMetricTypesToday.has(reminder.metric_type)) {
    return {
      shouldSendInitial: false,
      shouldSendFollowUp: false,
      reason: "already_recorded",
    };
  }

  const scheduledHHMM = reminder.scheduled_time.slice(0, 5);
  if (nowHHMM < scheduledHHMM) {
    return {
      shouldSendInitial: false,
      shouldSendFollowUp: false,
      reason: "before_scheduled_time",
    };
  }

  const todayDate = getLocalDateString(referenceDate, tz);
  const sentToday = todayLogsForReminder.filter((log) => {
    const logDate = getLocalDateString(new Date(log.scheduled_for), tz);
    return (
      logDate === todayDate &&
      (log.status === "sent" || log.status === "pending")
    );
  });

  if (sentToday.length === 0) {
    return {
      shouldSendInitial: true,
      shouldSendFollowUp: false,
      reason: "due",
    };
  }

  // Only one follow-up if follow_up_minutes is configured and hasn't been sent yet.
  if (reminder.follow_up_minutes && sentToday.length === 1) {
    const firstSentMs = new Date(
      sentToday[0].sent_at ?? sentToday[0].scheduled_for
    ).getTime();
    const elapsedMinutes = (referenceDate.getTime() - firstSentMs) / 60000;
    if (elapsedMinutes >= reminder.follow_up_minutes) {
      return {
        shouldSendInitial: false,
        shouldSendFollowUp: true,
        reason: "follow_up_due",
      };
    }
  }

  return {
    shouldSendInitial: false,
    shouldSendFollowUp: false,
    reason: "already_notified",
  };
}
