import { describe, expect, it } from "vitest";
import { buildInsightsSynthesis } from "@/lib/calculations/insights-synthesis";
import type { Tables } from "@/types/database";

describe("insights synthesis for daily patterns", () => {
  it("computes meal comparison, period shift, streak, and user-entered provider reference counts", () => {
    const configs: Tables<"tracking_configs">[] = [
      {
        id: "cfg-g",
        user_id: "u1",
        metric_type: "glucose",
        custom_label: null,
        enabled: true,
        unit: "mg/dL",
        show_on_dashboard: true,
        include_in_reports: true,
        provider_targets: { fastingMax: 95, postMealMax: 140 },
        schedule: {
          contexts: ["Fasting", "After breakfast"],
          slots: [
            {
              id: "fasting",
              context: "Fasting",
              time: "07:30",
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: "after-breakfast",
              context: "After breakfast",
              time: "09:30",
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
              postMealMinutes: 60,
            },
          ],
        },
        created_at: "2026-11-01T00:00:00.000Z",
        updated_at: "2026-11-01T00:00:00.000Z",
      },
    ];

    const glucoseRecords: Tables<"glucose_records">[] = [
      {
        id: "g1",
        user_id: "u1",
        value: 94,
        unit: "mg/dL",
        measured_at: "2026-11-20T07:30:00.000Z",
        entered_at: "2026-11-20T07:31:00.000Z",
        meal_context: "fasting",
        timing: "unknown",
        elapsed_minutes: null,
        notes: null,
        source: "manual",
        created_at: "2026-11-20T07:31:00.000Z",
        updated_at: "2026-11-20T07:31:00.000Z",
      },
      {
        id: "g2",
        user_id: "u1",
        value: 90,
        unit: "mg/dL",
        measured_at: "2026-11-22T07:30:00.000Z",
        entered_at: "2026-11-22T07:31:00.000Z",
        meal_context: "fasting",
        timing: "unknown",
        elapsed_minutes: null,
        notes: "Slept well",
        source: "voice",
        created_at: "2026-11-22T07:31:00.000Z",
        updated_at: "2026-11-22T07:31:00.000Z",
      },
      {
        id: "g3",
        user_id: "u1",
        value: 132,
        unit: "mg/dL",
        measured_at: "2026-11-22T09:30:00.000Z",
        entered_at: "2026-11-22T09:31:00.000Z",
        meal_context: "breakfast",
        timing: "after",
        elapsed_minutes: 60,
        notes: "Oats with berries",
        source: "manual",
        created_at: "2026-11-22T09:31:00.000Z",
        updated_at: "2026-11-22T09:31:00.000Z",
      },
      {
        id: "g4",
        user_id: "u1",
        value: 118,
        unit: "mg/dL",
        measured_at: "2026-11-23T20:30:00.000Z",
        entered_at: "2026-11-23T20:31:00.000Z",
        meal_context: "dinner",
        timing: "after",
        elapsed_minutes: 60,
        notes: "Evening walk",
        source: "voice",
        created_at: "2026-11-23T20:31:00.000Z",
        updated_at: "2026-11-23T20:31:00.000Z",
      },
    ];

    const synthesis = buildInsightsSynthesis({
      startDate: "2026-11-20",
      endDate: "2026-11-23",
      timezone: "UTC",
      glucoseUnit: "mg/dL",
      weightUnit: "kg",
      configs,
      glucoseRecords,
      bpRecords: [],
      weightRecords: [],
      customRecords: [],
      customMetrics: [],
      dailyNotes: [
        {
          id: "n1",
          user_id: "u1",
          note_date: "2026-11-22",
          content: "Balanced breakfast",
          created_at: "2026-11-22T10:00:00.000Z",
          updated_at: "2026-11-22T10:00:00.000Z",
        },
      ],
      pregnancyWeek: 26,
      providerName: "Dr. Nair",
    });

    expect(synthesis.mealComparison).toHaveLength(3);
    const fasting = synthesis.mealComparison.find((m) => m.key === "fasting");
    expect(fasting?.withinTargetCount).toBe(2);
    expect(synthesis.currentStreakDays).toBe(2);
    expect(synthesis.highlights.some((h) => h.id === "meal-pattern")).toBe(true);
    expect(synthesis.highlights.some((h) => h.id === "provider-ref")).toBe(true);
    expect(synthesis.glucoseCallouts.highest?.note).toBe("Oats with berries");
    expect(synthesis.visitPrepBullets.length).toBeGreaterThanOrEqual(2);
  });
});
