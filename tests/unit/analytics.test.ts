import { describe, expect, it } from "vitest";
import {
  buildBloodPressureAnalytics,
  buildCustomMetricsAnalytics,
  buildGlucoseAnalytics,
  buildWeightAnalytics,
  computeNumericStats,
  filterGlucoseByContext,
} from "@/lib/calculations/analytics";
import type { Tables } from "@/types/database";

function makeGlucose(
  overrides: Partial<Tables<"glucose_records">>
): Tables<"glucose_records"> {
  return {
    id: "g-1",
    user_id: "u-1",
    value: 95,
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
    ...overrides,
  };
}

describe("analytics calculations", () => {
  it("returns null statistics for empty arrays rather than zero", () => {
    expect(computeNumericStats([])).toEqual({
      count: 0,
      min: null,
      max: null,
      average: null,
      latest: null,
      earliest: null,
      change: null,
    });
  });

  it("keeps fasting and post-meal glucose averages strictly separated", () => {
    const records = [
      makeGlucose({
        id: "g1",
        value: 90,
        meal_context: "fasting",
        timing: "unknown",
        measured_at: "2026-11-20T07:30:00.000Z",
      }),
      makeGlucose({
        id: "g2",
        value: 94,
        meal_context: "fasting",
        timing: "unknown",
        measured_at: "2026-11-21T07:30:00.000Z",
      }),
      makeGlucose({
        id: "g3",
        value: 130,
        meal_context: "breakfast",
        timing: "after",
        elapsed_minutes: 60,
        measured_at: "2026-11-21T09:30:00.000Z",
      }),
    ];

    const analytics = buildGlucoseAnalytics(records, "UTC", "mg/dL", "all");
    expect(analytics.breakdowns.fasting.average).toBe(92);
    expect(analytics.breakdowns.fasting.count).toBe(2);
    expect(analytics.breakdowns.afterMeals.average).toBe(130);
    expect(analytics.breakdowns.afterMeals.count).toBe(1);
    expect(analytics.breakdowns.beforeMeals.count).toBe(0);
    expect(filterGlucoseByContext(records, "breakfast")).toHaveLength(1);
  });

  it("computes blood pressure systolic, diastolic, and optional pulse stats", () => {
    const records: Tables<"blood_pressure_records">[] = [
      {
        id: "bp1",
        user_id: "u1",
        systolic: 116,
        diastolic: 74,
        pulse: 70,
        measured_at: "2026-11-20T08:00:00.000Z",
        entered_at: "2026-11-20T08:01:00.000Z",
        notes: null,
        source: "manual",
        created_at: "2026-11-20T08:01:00.000Z",
        updated_at: "2026-11-20T08:01:00.000Z",
      },
      {
        id: "bp2",
        user_id: "u1",
        systolic: 120,
        diastolic: 78,
        pulse: null,
        measured_at: "2026-11-21T08:00:00.000Z",
        entered_at: "2026-11-21T08:01:00.000Z",
        notes: null,
        source: "manual",
        created_at: "2026-11-21T08:01:00.000Z",
        updated_at: "2026-11-21T08:01:00.000Z",
      },
    ];

    const bp = buildBloodPressureAnalytics(records, "UTC");
    expect(bp.count).toBe(2);
    expect(bp.systolic.average).toBe(118);
    expect(bp.diastolic.average).toBe(76);
    expect(bp.pulse.count).toBe(1);
    expect(bp.pulse.average).toBe(70);
  });

  it("computes weight period change in configured unit", () => {
    const records: Tables<"weight_records">[] = [
      {
        id: "w1",
        user_id: "u1",
        value: 64.0,
        unit: "kg",
        measured_at: "2026-11-15T07:45:00.000Z",
        entered_at: "2026-11-15T07:46:00.000Z",
        notes: null,
        source: "manual",
        created_at: "2026-11-15T07:46:00.000Z",
        updated_at: "2026-11-15T07:46:00.000Z",
      },
      {
        id: "w2",
        user_id: "u1",
        value: 64.5,
        unit: "kg",
        measured_at: "2026-11-22T07:45:00.000Z",
        entered_at: "2026-11-22T07:46:00.000Z",
        notes: null,
        source: "manual",
        created_at: "2026-11-22T07:46:00.000Z",
        updated_at: "2026-11-22T07:46:00.000Z",
      },
    ];

    const weight = buildWeightAnalytics(records, "UTC", "kg");
    expect(weight.stats.change).toBe(0.5);
    expect(weight.stats.latest).toBe(64.5);
  });

  it("aggregates numeric custom metrics and counts text observations separately", () => {
    const configs: Tables<"tracking_configs">[] = [
      {
        id: "cfg-hr",
        user_id: "u1",
        metric_type: "custom",
        custom_label: "Heart Rate",
        enabled: true,
        schedule: { contexts: [], slots: [] },
        provider_targets: null,
        unit: "bpm",
        show_on_dashboard: true,
        include_in_reports: true,
        created_at: "2026-11-20T00:00:00.000Z",
        updated_at: "2026-11-20T00:00:00.000Z",
      },
    ];
    const records: Tables<"custom_metric_records">[] = [
      {
        id: "c1",
        user_id: "u1",
        metric_config_id: "cfg-hr",
        value_numeric: 72,
        value_text: null,
        unit: "bpm",
        measured_at: "2026-11-21T09:00:00.000Z",
        entered_at: "2026-11-21T09:01:00.000Z",
        notes: null,
        source: "manual",
        created_at: "2026-11-21T09:01:00.000Z",
        updated_at: "2026-11-21T09:01:00.000Z",
      },
      {
        id: "c2",
        user_id: "u1",
        metric_config_id: "cfg-hr",
        value_numeric: 76,
        value_text: null,
        unit: "bpm",
        measured_at: "2026-11-22T09:00:00.000Z",
        entered_at: "2026-11-22T09:01:00.000Z",
        notes: null,
        source: "manual",
        created_at: "2026-11-22T09:01:00.000Z",
        updated_at: "2026-11-22T09:01:00.000Z",
      },
    ];

    const series = buildCustomMetricsAnalytics(records, configs, "UTC");
    expect(series).toHaveLength(1);
    expect(series[0].label).toBe("Heart Rate");
    expect(series[0].stats.average).toBe(74);
    expect(series[0].stats.latest).toBe(76);
    expect(series[0].points).toHaveLength(2);
  });
});
