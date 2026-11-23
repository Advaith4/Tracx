import { z } from "zod";

export const extractedGlucoseItemSchema = z.object({
  kind: z.literal("glucose"),
  value: z.number().positive().max(1500),
  unit: z.enum(["mg/dL", "mmol/L"]),
  meal_context: z.enum([
    "fasting",
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "unknown",
  ]),
  timing: z.enum(["before", "after", "unknown"]),
  elapsed_minutes: z.number().int().min(0).max(600).nullable(),
  measured_at_iso: z.string(),
  notes: z.string().max(500).nullable(),
});

export const extractedBloodPressureItemSchema = z.object({
  kind: z.literal("blood_pressure"),
  systolic: z.number().int().min(40).max(300),
  diastolic: z.number().int().min(20).max(200),
  pulse: z.number().int().min(20).max(250).nullable(),
  measured_at_iso: z.string(),
  notes: z.string().max(500).nullable(),
});

export const extractedWeightItemSchema = z.object({
  kind: z.literal("weight"),
  value: z.number().positive().max(1000),
  unit: z.enum(["kg", "lb"]),
  measured_at_iso: z.string(),
  notes: z.string().max(500).nullable(),
});

export const extractedDailyNoteItemSchema = z.object({
  kind: z.literal("daily_note"),
  note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().min(1).max(1000),
});

export const extractedItemSchema = z.discriminatedUnion("kind", [
  extractedGlucoseItemSchema,
  extractedBloodPressureItemSchema,
  extractedWeightItemSchema,
  extractedDailyNoteItemSchema,
]);

export type ExtractedMeasurementItem = z.infer<typeof extractedItemSchema>;

export const extractedMeasurementResponseSchema = z.object({
  records: z.array(extractedItemSchema),
  needs_clarification: z.boolean(),
  clarification_question: z.string().nullable(),
  missing_fields: z.array(z.string()),
});

export type ExtractedMeasurementResponse = z.infer<
  typeof extractedMeasurementResponseSchema
>;

export const extractRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(2, "Please speak or type a measurement first.")
    .max(1000, "Input text is too long."),
  localNowIso: z.string().optional(),
  timezone: z.string().optional(),
});

export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, "Please enter a question.")
    .max(800, "Question must be 800 characters or fewer."),
  rangePreset: z.enum(["7d", "14d", "30d"]).default("14d"),
});
