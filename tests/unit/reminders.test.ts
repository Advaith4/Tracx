import { describe, expect, it } from "vitest";
import {
  buildPrivacySafeNotificationCopy,
  encodeReminderMetricType,
  evaluateReminderDueState,
  isTimeInQuietHours,
  parseReminderMetricMeta,
} from "@/lib/notifications/reminder-logic";
import type { Tables } from "@/types/database";

function makeReminder(
  overrides?: Partial<Tables<"reminders">>
): Tables<"reminders"> {
  return {
    id: "rem-1",
    user_id: "user-1",
    metric_type: "glucose",
    label: "Fasting blood sugar",
    scheduled_time: "07:30:00",
    timezone: "UTC",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    channel: "in_app",
    enabled: true,
    follow_up_minutes: 30,
    snooze_minutes: 15,
    quiet_hours_start: null,
    quiet_hours_end: null,
    created_at: "2026-11-22T00:00:00.000Z",
    updated_at: "2026-11-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("reminder-logic", () => {
  it("detects both same-day and overnight quiet hours", () => {
    expect(isTimeInQuietHours("14:00", "13:00", "15:00")).toBe(true);
    expect(isTimeInQuietHours("16:00", "13:00", "15:00")).toBe(false);
    expect(isTimeInQuietHours("23:30", "22:00", "07:00")).toBe(true);
    expect(isTimeInQuietHours("06:15", "22:00", "07:00")).toBe(true);
    expect(isTimeInQuietHours("08:00", "22:00", "07:00")).toBe(false);
  });

  it("hides sensitive health details in default notification copy", () => {
    const reminder = makeReminder({ label: "Fasting blood glucose" });
    const safeCopy = buildPrivacySafeNotificationCopy(reminder, false);
    expect(safeCopy.body).toBe("Your scheduled health check-in is due.");
    expect(safeCopy.body.toLowerCase()).not.toContain("glucose");

    const detailed = buildPrivacySafeNotificationCopy(reminder, true);
    expect(detailed.body).toContain("Fasting blood glucose");
  });

  it("suppresses reminders once a measurement for that metric is recorded today", () => {
    const result = evaluateReminderDueState({
      reminder: makeReminder(),
      referenceDate: new Date("2026-11-23T07:45:00.000Z"),
      completedMetricTypesToday: new Set(["glucose"]),
      todayLogsForReminder: [],
    });

    expect(result.shouldSendInitial).toBe(false);
    expect(result.reason).toBe("already_recorded");
  });

  it("triggers initial reminder and one follow-up after follow_up_minutes", () => {
    const reminder = makeReminder({ follow_up_minutes: 30 });

    const initial = evaluateReminderDueState({
      reminder,
      referenceDate: new Date("2026-11-23T07:35:00.000Z"),
      completedMetricTypesToday: new Set(),
      todayLogsForReminder: [],
    });
    expect(initial.shouldSendInitial).toBe(true);

    const followUp = evaluateReminderDueState({
      reminder,
      referenceDate: new Date("2026-11-23T08:10:00.000Z"),
      completedMetricTypesToday: new Set(),
      todayLogsForReminder: [
        {
          id: "log-1",
          user_id: "user-1",
          reminder_id: "rem-1",
          scheduled_for: "2026-11-23T07:35:00.000Z",
          sent_at: "2026-11-23T07:35:00.000Z",
          read_at: null,
          channel: "in_app",
          status: "sent",
          error_message: null,
          created_at: "2026-11-23T07:35:00.000Z",
        },
      ],
    });
    expect(followUp.shouldSendFollowUp).toBe(true);
  });

  it("encodes and evaluates date-specific reminders and appointments accurately", () => {
    const encoded = encodeReminderMetricType("appointment", "2026-11-26");
    expect(encoded).toBe("appointment@2026-11-26");
    expect(parseReminderMetricMeta(encoded)).toEqual({
      category: "appointment",
      scheduledDate: "2026-11-26",
    });

    const reminder = makeReminder({
      metric_type: encoded,
      label: "OB Ultrasound",
      scheduled_time: "10:00:00",
    });

    // Wrong date -> must not fire
    const wrongDay = evaluateReminderDueState({
      reminder,
      referenceDate: new Date("2026-11-25T10:15:00.000Z"),
      completedMetricTypesToday: new Set(["glucose"]),
      todayLogsForReminder: [],
    });
    expect(wrongDay.shouldSendInitial).toBe(false);
    expect(wrongDay.reason).toBe("not_scheduled_today");

    // Matching date -> fires even if health measurements were logged that day
    const exactDay = evaluateReminderDueState({
      reminder,
      referenceDate: new Date("2026-11-26T10:05:00.000Z"),
      completedMetricTypesToday: new Set(["glucose", "blood_pressure"]),
      todayLogsForReminder: [],
    });
    expect(exactDay.shouldSendInitial).toBe(true);
    expect(exactDay.reason).toBe("due");
  });

  it("respects active snooze windows before re-firing", () => {
    const reminder = makeReminder({ scheduled_time: "08:00:00" });
    const result = evaluateReminderDueState({
      reminder,
      referenceDate: new Date("2026-11-23T08:10:00.000Z"),
      completedMetricTypesToday: new Set(),
      todayLogsForReminder: [
        {
          id: "log-snooze",
          user_id: "user-1",
          reminder_id: "rem-1",
          scheduled_for: "2026-11-23T08:05:00.000Z",
          sent_at: null,
          read_at: "2026-11-23T08:06:00.000Z",
          channel: "in_app",
          status: "skipped",
          error_message:
            "Snoozed for 15 minutes (until 2026-11-23T08:21:00.000Z)",
          created_at: "2026-11-23T08:05:00.000Z",
        },
      ],
    });
    expect(result.shouldSendInitial).toBe(false);
    expect(result.reason).toBe("snoozed");
  });
});
