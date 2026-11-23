import { describe, expect, it } from "vitest";
import {
  buildDeterministicFallbackNarrative,
  computeWeeklyReportStatistics,
} from "@/lib/calculations/weekly-report";
import type { Tables } from "@/types/database";

describe("weekly-report calculations", () => {
  it("separates glucose contexts and counts missing/skipped accurately", () => {
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
        schedule: {
          contexts: ["Fasting"],
          slots: [
            {
              id: "s1",
              context: "Fasting",
              time: "07:30",
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
          ],
        },
        provider_targets: null,
        created_at: "2026-11-01T00:00:00.000Z",
        updated_at: "2026-11-01T00:00:00.000Z",
      },
    ];

    const stats = computeWeeklyReportStatistics({
      periodStart: "2026-11-17",
      periodEnd: "2026-11-23",
      timezone: "UTC",
      configs,
      glucoseRecords: [
        {
          id: "g1",
          user_id: "u1",
          value: 92,
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
          value: 128,
          unit: "mg/dL",
          measured_at: "2026-11-20T09:30:00.000Z",
          entered_at: "2026-11-20T09:31:00.000Z",
          meal_context: "breakfast",
          timing: "after",
          elapsed_minutes: 60,
          notes: null,
          source: "voice",
          created_at: "2026-11-20T09:31:00.000Z",
          updated_at: "2026-11-20T09:31:00.000Z",
        },
      ],
      bpRecords: [],
      weightRecords: [],
      customRecords: [],
      skips: [
        {
          id: "sk1",
          user_id: "u1",
          metric_type: "glucose",
          tracking_config_id: "cfg-g",
          scheduled_date: "2026-11-21",
          context_label: "Fasting",
          reason: null,
          created_at: "2026-11-21T08:00:00.000Z",
        },
      ],
      dailyNotes: [],
    });

    expect(stats.overview.totalScheduled).toBe(7);
    expect(stats.overview.totalRecorded).toBe(2);
    expect(stats.overview.totalSkipped).toBe(1);
    expect(stats.overview.missingCount).toBe(4);

    const fasting = stats.glucose.contexts.find((c) => c.key === "fasting");
    const afterBreakfast = stats.glucose.contexts.find(
      (c) => c.key === "afterBreakfast"
    );
    expect(fasting?.stats.average).toBe(92);
    expect(afterBreakfast?.stats.average).toBe(128);

    const fallback = buildDeterministicFallbackNarrative(stats);
    expect(fallback.observations.length).toBeGreaterThanOrEqual(2);
    expect(fallback.providerQuestions.length).toBeGreaterThanOrEqual(2);
  });
});
