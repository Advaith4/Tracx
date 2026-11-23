import { describe, expect, it } from "vitest";
import {
  createCustomMetricSchema,
  updateTrackingConfigSchema,
} from "@/features/tracking-config/schemas";
import {
  formatTime12h,
  getTodayScheduledTasks,
} from "@/features/tracking-config/schedule-utils";
import { deduplicateTrackingConfigs } from "@/features/tracking-config/service";
import type { Tables } from "@/types/database";

const BASE_TIMESTAMP = "2026-11-22T00:00:00.000Z";

function makeConfig(
  overrides: Partial<Tables<"tracking_configs">>
): Tables<"tracking_configs"> {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    metric_type: "glucose",
    custom_label: null,
    enabled: true,
    schedule: { contexts: [], slots: [] },
    provider_targets: null,
    unit: "mg/dL",
    show_on_dashboard: true,
    include_in_reports: true,
    created_at: BASE_TIMESTAMP,
    updated_at: BASE_TIMESTAMP,
    ...overrides,
  };
}

describe("tracking-config schemas", () => {
  it("accepts a valid custom metric configuration", () => {
    const result = createCustomMetricSchema.safeParse({
      custom_label: "Body Temperature",
      unit: "°C",
      show_on_dashboard: true,
      include_in_reports: true,
      schedule: {
        contexts: ["Morning"],
        slots: [
          {
            id: "slot-1",
            context: "Morning",
            time: "08:00",
            daysOfWeek: [1, 3, 5],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid slot time format", () => {
    const result = updateTrackingConfigSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      enabled: true,
      unit: "mg/dL",
      show_on_dashboard: true,
      include_in_reports: true,
      schedule: {
        contexts: ["Fasting"],
        slots: [
          {
            id: "slot-1",
            context: "Fasting",
            time: "99:00",
            daysOfWeek: [0],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("schedule-utils", () => {
  it("formats 24-hour times into 12-hour strings", () => {
    expect(formatTime12h("00:05")).toBe("12:05 AM");
    expect(formatTime12h("07:30")).toBe("7:30 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("20:45")).toBe("8:45 PM");
  });

  it("expands today's enabled dashboard slots in chronological order", () => {
    // 2026-11-22 is a Sunday (dayOfWeek = 0) at 08:15 UTC
    const reference = new Date("2026-11-22T08:15:00.000Z");

    const configs: Tables<"tracking_configs">[] = [
      makeConfig({
        id: "cfg-glucose",
        metric_type: "glucose",
        enabled: true,
        show_on_dashboard: true,
        schedule: {
          contexts: ["Fasting", "After breakfast"],
          slots: [
            {
              id: "g-after",
              context: "After breakfast",
              time: "09:30",
              daysOfWeek: [0],
              postMealMinutes: 60,
            },
            {
              id: "g-fasting",
              context: "Fasting",
              time: "07:30",
              daysOfWeek: [0],
            },
          ],
        },
      }),
      makeConfig({
        id: "cfg-weight-disabled",
        metric_type: "weight",
        enabled: false,
        show_on_dashboard: true,
        schedule: {
          contexts: ["Morning"],
          slots: [
            {
              id: "w-morning",
              context: "Morning",
              time: "07:00",
              daysOfWeek: [0],
            },
          ],
        },
      }),
      makeConfig({
        id: "cfg-bp-monday-only",
        metric_type: "blood_pressure",
        enabled: true,
        show_on_dashboard: true,
        schedule: {
          contexts: ["Morning"],
          slots: [
            {
              id: "bp-mon",
              context: "Morning",
              time: "08:00",
              daysOfWeek: [1],
            },
          ],
        },
      }),
    ];

    const tasks = getTodayScheduledTasks(configs, "UTC", reference);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      measurementName: "Blood Glucose",
      context: "Fasting",
      scheduledTime: "7:30 AM",
      status: "pending",
    });
    expect(tasks[1]).toMatchObject({
      measurementName: "Blood Glucose",
      context: "After breakfast · 60m",
      scheduledTime: "9:30 AM",
      status: "upcoming",
    });
  });

  it("deduplicates duplicate built-in starter configs and duplicate scheduled slots", () => {
    const slot = {
      id: "fasting",
      context: "Fasting",
      time: "07:30",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    };

    const duplicatedConfigs = [
      makeConfig({
        id: "cfg-glucose-1",
        metric_type: "glucose",
        created_at: "2026-11-22T00:00:00.000Z",
        schedule: { contexts: ["Fasting"], slots: [slot] },
      }),
      makeConfig({
        id: "cfg-glucose-2",
        metric_type: "glucose",
        created_at: "2026-11-22T00:00:01.000Z",
        schedule: { contexts: ["Fasting"], slots: [slot] },
      }),
      makeConfig({
        id: "cfg-custom-1",
        metric_type: "custom",
        custom_label: "Heart Rate",
        created_at: "2026-11-22T00:00:02.000Z",
        schedule: { contexts: ["Daily"], slots: [{ ...slot, id: "hr", time: "09:00", context: "Daily" }] },
      }),
    ];

    const { unique, duplicateIds } = deduplicateTrackingConfigs(duplicatedConfigs);
    expect(unique).toHaveLength(2);
    expect(duplicateIds).toEqual(["cfg-glucose-2"]);

    const tasks = getTodayScheduledTasks(
      duplicatedConfigs,
      "UTC",
      new Date("2026-11-23T06:00:00.000Z")
    );
    expect(tasks).toHaveLength(2);
  });
});
