import { describe, expect, it } from "vitest";
import {
  checkAiRateLimit,
  detectUrgentSymptomMention,
} from "@/lib/ai/safety";
import {
  chatRequestSchema,
  extractedMeasurementResponseSchema,
} from "@/lib/ai/schemas";

describe("AI schemas and safety", () => {
  it("validates multi-measurement structured extraction payloads", () => {
    const parsed = extractedMeasurementResponseSchema.safeParse({
      records: [
        {
          kind: "glucose",
          value: 92,
          unit: "mg/dL",
          meal_context: "fasting",
          timing: "unknown",
          elapsed_minutes: null,
          measured_at_iso: "2026-11-23T07:30:00.000Z",
          notes: null,
        },
        {
          kind: "blood_pressure",
          systolic: 118,
          diastolic: 76,
          pulse: null,
          measured_at_iso: "2026-11-23T07:30:00.000Z",
          notes: null,
        },
        {
          kind: "weight",
          value: 64.2,
          unit: "kg",
          measured_at_iso: "2026-11-23T07:30:00.000Z",
          notes: null,
        },
      ],
      needs_clarification: false,
      clarification_question: null,
      missing_fields: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("supports clarification responses without guessing", () => {
    const parsed = extractedMeasurementResponseSchema.safeParse({
      records: [],
      needs_clarification: true,
      clarification_question:
        "Was this a fasting measurement or before/after a meal?",
      missing_fields: ["meal_context"],
    });

    expect(parsed.success).toBe(true);
  });

  it("validates chat requests and detects urgent symptom mentions", () => {
    expect(
      chatRequestSchema.safeParse({
        message: "What was my fasting sugar this week?",
        rangePreset: "7d",
      }).success
    ).toBe(true);

    expect(detectUrgentSymptomMention("I have chest pain and dizziness")).toBe(
      true
    );
    expect(
      detectUrgentSymptomMention("Show my breakfast readings for last week")
    ).toBe(false);
  });

  it("enforces per-user rate limiting", () => {
    const testUser = "rate-limit-test-user";
    const start = 1_700_000_000_000;
    for (let i = 0; i < 20; i++) {
      expect(checkAiRateLimit(testUser, start + i * 100).allowed).toBe(true);
    }
    const blocked = checkAiRateLimit(testUser, start + 5000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
