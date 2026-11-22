import { z } from "zod";

const isoDatetimeSchema = z
  .string()
  .refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Please enter a valid date and time.",
  });

const optionalNotesSchema = z
  .string()
  .trim()
  .max(1000, "Notes must be 1000 characters or fewer.")
  .nullable()
  .optional();

const sourceSchema = z.enum(["manual", "voice", "import"]).default("manual");

export const glucoseRecordSchema = z.object({
  value: z
    .number({ error: "Please enter a glucose value." })
    .positive("Glucose value must be greater than zero.")
    .max(1500, "Please check the glucose value entered."),
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
  elapsed_minutes: z
    .number()
    .int()
    .min(0, "Elapsed time cannot be negative.")
    .max(600, "Elapsed time must be 600 minutes or fewer.")
    .nullable()
    .optional(),
  measured_at: isoDatetimeSchema,
  notes: optionalNotesSchema,
  source: sourceSchema,
  allowDuplicate: z.boolean().optional(),
});

export type GlucoseRecordInput = z.infer<typeof glucoseRecordSchema>;

export const bloodPressureRecordSchema = z
  .object({
    systolic: z
      .number({ error: "Please enter systolic pressure." })
      .int("Systolic pressure must be a whole number.")
      .min(40, "Systolic pressure must be at least 40.")
      .max(300, "Systolic pressure must be 300 or less."),
    diastolic: z
      .number({ error: "Please enter diastolic pressure." })
      .int("Diastolic pressure must be a whole number.")
      .min(20, "Diastolic pressure must be at least 20.")
      .max(200, "Diastolic pressure must be 200 or less."),
    pulse: z
      .number()
      .int("Pulse must be a whole number.")
      .min(20, "Pulse must be at least 20.")
      .max(250, "Pulse must be 250 or less.")
      .nullable()
      .optional(),
    measured_at: isoDatetimeSchema,
    notes: optionalNotesSchema,
    source: sourceSchema,
    allowDuplicate: z.boolean().optional(),
  })
  .refine((data) => data.systolic > data.diastolic, {
    message: "Systolic pressure must be higher than diastolic pressure.",
    path: ["systolic"],
  });

export type BloodPressureRecordInput = z.infer<
  typeof bloodPressureRecordSchema
>;

export const weightRecordSchema = z.object({
  value: z
    .number({ error: "Please enter a weight value." })
    .positive("Weight must be greater than zero.")
    .max(1000, "Please check the weight value entered."),
  unit: z.enum(["kg", "lb"]),
  measured_at: isoDatetimeSchema,
  notes: optionalNotesSchema,
  source: sourceSchema,
  allowDuplicate: z.boolean().optional(),
});

export type WeightRecordInput = z.infer<typeof weightRecordSchema>;

export const customMetricRecordSchema = z
  .object({
    metric_config_id: z.string().uuid("Please select a custom metric."),
    value_numeric: z.number().finite().nullable().optional(),
    value_text: z.string().trim().max(200).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    measured_at: isoDatetimeSchema,
    notes: optionalNotesSchema,
    source: sourceSchema,
    allowDuplicate: z.boolean().optional(),
  })
  .refine(
    (data) =>
      (data.value_numeric !== null && data.value_numeric !== undefined) ||
      Boolean(data.value_text && data.value_text.trim().length > 0),
    {
      message: "Please enter a numeric or text value.",
      path: ["value_numeric"],
    }
  );

export type CustomMetricRecordInput = z.infer<typeof customMetricRecordSchema>;

export const skipMeasurementSchema = z.object({
  metric_type: z.enum(["glucose", "blood_pressure", "weight", "custom"]),
  tracking_config_id: z.string().uuid().nullable().optional(),
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format."),
  context_label: z.string().trim().max(80).nullable().optional(),
  reason: z.string().trim().max(300).nullable().optional(),
});

export type SkipMeasurementInput = z.infer<typeof skipMeasurementSchema>;

export const dailyNoteSchema = z.object({
  note_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format."),
  content: z
    .string()
    .trim()
    .max(2000, "Daily note must be 2000 characters or fewer."),
});

export type DailyNoteInput = z.infer<typeof dailyNoteSchema>;
