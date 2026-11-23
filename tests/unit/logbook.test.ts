import { describe, expect, it } from "vitest";
import {
  buildAllEntriesCsv,
  buildDailySheetCsv,
  buildDailySpreadsheet,
} from "@/features/logbook/build-spreadsheet";
import type { UnifiedMeasurement } from "@/features/measurements/service";
import type { Tables } from "@/types/database";

function makeConfig(
  overrides: Partial<Tables<"tracking_configs">>
): Tables<"tracking_configs"> {
  return {
    id: "cfg-1",
    user_id: "user-1",
    metric_type: "glucose",
    custom_label: null,
    enabled: true,
    schedule: {},
    provider_targets: null,
    unit: "mg/dL",
    show_on_dashboard: true,
    include_in_reports: true,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildDailySpreadsheet", () => {
  it("pivots daily recordings into Excel-style meal/metric columns and averages", () => {
    const entries: UnifiedMeasurement[] = [
      {
        id: "g-1",
        metricType: "glucose",
        metricLabel: "Blood Glucose",
        displayValue: "92 mg/dL",
        unit: "mg/dL",
        contextLabel: "Fasting",
        measuredAt: "2026-11-23T07:30:00.000Z",
        measuredAtLabel: "Today, 7:30 AM",
        enteredAt: "2026-11-23T07:31:00.000Z",
        notes: "Normal sleep",
        source: "manual",
        rawGlucose: {
          id: "g-1",
          user_id: "user-1",
          value: 92,
          unit: "mg/dL",
          measured_at: "2026-11-23T07:30:00.000Z",
          entered_at: "2026-11-23T07:31:00.000Z",
          meal_context: "fasting",
          timing: "before",
          elapsed_minutes: null,
          notes: "Normal sleep",
          source: "manual",
          created_at: "2026-11-23T07:31:00.000Z",
          updated_at: "2026-11-23T07:31:00.000Z",
        },
      },
      {
        id: "g-2",
        metricType: "glucose",
        metricLabel: "Blood Glucose",
        displayValue: "148 mg/dL",
        unit: "mg/dL",
        contextLabel: "After breakfast · 60m",
        measuredAt: "2026-11-23T09:30:00.000Z",
        measuredAtLabel: "Today, 9:30 AM",
        enteredAt: "2026-11-23T09:31:00.000Z",
        notes: "Pancakes",
        source: "voice",
        rawGlucose: {
          id: "g-2",
          user_id: "user-1",
          value: 148,
          unit: "mg/dL",
          measured_at: "2026-11-23T09:30:00.000Z",
          entered_at: "2026-11-23T09:31:00.000Z",
          meal_context: "breakfast",
          timing: "after",
          elapsed_minutes: 60,
          notes: "Pancakes",
          source: "voice",
          created_at: "2026-11-23T09:31:00.000Z",
          updated_at: "2026-11-23T09:31:00.000Z",
        },
      },
      {
        id: "bp-1",
        metricType: "blood_pressure",
        metricLabel: "Blood Pressure",
        displayValue: "118/76 mmHg",
        unit: "mmHg",
        contextLabel: "Pulse 74 bpm",
        measuredAt: "2026-11-23T08:00:00.000Z",
        measuredAtLabel: "Today, 8:00 AM",
        enteredAt: "2026-11-23T08:01:00.000Z",
        notes: null,
        source: "manual",
        rawBloodPressure: {
          id: "bp-1",
          user_id: "user-1",
          systolic: 118,
          diastolic: 76,
          pulse: 74,
          measured_at: "2026-11-23T08:00:00.000Z",
          entered_at: "2026-11-23T08:01:00.000Z",
          notes: null,
          source: "manual",
          created_at: "2026-11-23T08:01:00.000Z",
          updated_at: "2026-11-23T08:01:00.000Z",
        },
      },
    ];

    const configs = [
      makeConfig({
        id: "cfg-g",
        metric_type: "glucose",
        unit: "mg/dL",
        provider_targets: { fastingMax: 95, postMealMax: 140 },
      }),
      makeConfig({
        id: "cfg-bp",
        metric_type: "blood_pressure",
        unit: "mmHg",
      }),
      makeConfig({
        id: "cfg-w",
        metric_type: "weight",
        unit: "kg",
      }),
    ];

    const sheet = buildDailySpreadsheet({
      entries,
      dailyNotes: [{ note_date: "2026-11-23", content: "=Felt energized" }],
      configs,
      startDate: "2026-11-22",
      endDate: "2026-11-23",
      timezone: "UTC",
    });

    expect(sheet.rows.length).toBe(2);
    const nov23 = sheet.rows[0];
    expect(nov23.date).toBe("2026-11-23");
    expect(nov23.glucoseCells.fasting[0]?.displayText).toBe("92");
    expect(nov23.glucoseCells.fasting[0]?.aboveReference).toBe(false);
    expect(nov23.glucoseCells.afterBreakfast[0]?.displayText).toBe("148");
    expect(nov23.glucoseCells.afterBreakfast[0]?.aboveReference).toBe(true);
    expect(nov23.glucoseDayAvg).toBe(120);
    expect(nov23.bloodPressure[0]?.displayText).toBe("118/76 (74)");

    expect(sheet.summary.overallGlucoseAverage).toBe(120);
    expect(sheet.summary.avgSystolic).toBe(118);

    const dailyCsv = buildDailySheetCsv(sheet);
    expect(dailyCsv).toContain("Fasting (mg/dL)");
    expect(dailyCsv).toContain("'=Felt energized");

    const allCsv = buildAllEntriesCsv(entries, "UTC");
    expect(allCsv).toContain("Blood Glucose");
    expect(allCsv).toContain("148");
  });
});
