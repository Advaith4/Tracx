import { describe, expect, it } from "vitest";
import {
  buildPrivacySafeNotificationCopy,
  evaluateReminderDueState,
  isTimeInQuietHours,
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
});
