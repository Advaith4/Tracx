import { describe, expect, it } from "vitest";
import { resolveTodayTasksWithRecords } from "@/lib/calculations/daily-status";
import {
  bloodPressureRecordSchema,
  customMetricRecordSchema,
  glucoseRecordSchema,
  weightRecordSchema,
} from "@/lib/validation/measurements";
import type { TodayScheduledTask } from "@/features/tracking-config/schedule-utils";

describe("measurement validation schemas", () => {
  it("validates a post-meal glucose record with elapsed time", () => {
    const result = glucoseRecordSchema.safeParse({
      value: 126,
      unit: "mg/dL",
      meal_context: "breakfast",
      timing: "after",
      elapsed_minutes: 60,
      measured_at: "2026-11-22T09:30:00.000Z",
      notes: "Oatmeal",
    });

    expect(result.success).toBe(true);
  });

  it("rejects blood pressure when systolic is not greater than diastolic", () => {
    const result = bloodPressureRecordSchema.safeParse({
      systolic: 80,
      diastolic: 90,
      measured_at: "2026-11-22T08:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("validates weight and custom metric records", () => {
    expect(
      weightRecordSchema.safeParse({
        value: 64.2,
        unit: "kg",
        measured_at: "2026-11-22T07:45:00.000Z",
      }).success
    ).toBe(true);

    expect(
      customMetricRecordSchema.safeParse({
        metric_config_id: "11111111-1111-4111-8111-111111111111",
        value_numeric: null,
        value_text: null,
        measured_at: "2026-11-22T09:00:00.000Z",
      }).success
    ).toBe(false);
  });
});

describe("resolveTodayTasksWithRecords", () => {
  it("marks matched glucose, late BP, and skipped weight tasks accurately", () => {
    const tasks: TodayScheduledTask[] = [
      {
        id: "cfg-g:fasting",
        configId: "cfg-g",
        metricType: "glucose",
        measurementName: "Blood Glucose",
        context: "Fasting",
        scheduledTime: "7:30 AM",
        rawTime: "07:30",
        status: "pending",
      },
      {
        id: "cfg-bp:morning",
        configId: "cfg-bp",
        metricType: "blood_pressure",
        measurementName: "Blood Pressure",
        context: "Morning",
        scheduledTime: "8:00 AM",
        rawTime: "08:00",
        status: "pending",
      },
      {
        id: "cfg-w:morning",
        configId: "cfg-w",
        metricType: "weight",
        measurementName: "Weight",
        context: "Morning",
        scheduledTime: "7:45 AM",
        rawTime: "07:45",
        status: "pending",
      },
    ];

    const resolved = resolveTodayTasksWithRecords({
      tasks,
      timezone: "UTC",
      todayDate: "2026-11-22",
      glucoseRecords: [
        {
          id: "g1",
          user_id: "u1",
          value: 92,
          unit: "mg/dL",
          measured_at: "2026-11-22T07:40:00.000Z",
          entered_at: "2026-11-22T07:41:00.000Z",
          meal_context: "fasting",
          timing: "unknown",
          elapsed_minutes: null,
          notes: null,
          source: "manual",
          created_at: "2026-11-22T07:41:00.000Z",
          updated_at: "2026-11-22T07:41:00.000Z",
        },
      ],
      bpRecords: [
        {
          id: "bp1",
          user_id: "u1",
          systolic: 118,
          diastolic: 76,
          pulse: 72,
          measured_at: "2026-11-22T10:15:00.000Z",
          entered_at: "2026-11-22T10:16:00.000Z",
          notes: null,
          source: "manual",
          created_at: "2026-11-22T10:16:00.000Z",
          updated_at: "2026-11-22T10:16:00.000Z",
        },
      ],
      weightRecords: [],
      customRecords: [],
      skips: [
        {
          id: "s1",
          user_id: "u1",
          metric_type: "weight",
          tracking_config_id: "cfg-w",
          scheduled_date: "2026-11-22",
          context_label: "Morning",
          reason: null,
          created_at: "2026-11-22T08:00:00.000Z",
        },
      ],
    });

    expect(resolved[0]).toMatchObject({
      status: "recorded",
      recordedValue: "92 mg/dL",
    });
    expect(resolved[1]).toMatchObject({
      status: "late",
      recordedValue: "118/76 mmHg",
    });
    expect(resolved[2]).toMatchObject({
      status: "skipped",
    });
  });
});
