import { z } from "zod";
import type { Json } from "@/types/database";

export const scheduleSlotSchema = z.object({
  id: z.string().min(1),
  context: z
    .string()
    .trim()
    .min(1, "Context name is required.")
    .max(60, "Context name is too long."),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour time format."),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Select at least one day."),
  postMealMinutes: z
    .number()
    .int()
    .min(15)
    .max(240)
    .nullable()
    .optional(),
});

export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;

export const trackingScheduleSchema = z.object({
  contexts: z.array(z.string().trim().min(1).max(60)).default([]),
  slots: z.array(scheduleSlotSchema).default([]),
  requireContext: z.boolean().optional(),
});

export type TrackingScheduleConfig = z.infer<typeof trackingScheduleSchema>;

export const providerTargetsSchema = z
  .object({
    note: z.string().trim().max(300, "Target note is too long.").optional(),
  })
  .nullable()
  .optional();

export type ProviderTargets = z.infer<typeof providerTargetsSchema>;

export const updateTrackingConfigSchema = z.object({
  id: z.string().uuid("Invalid tracking configuration ID."),
  custom_label: z.string().trim().max(60).nullable().optional(),
  enabled: z.boolean(),
  unit: z.string().trim().min(1, "Unit is required.").max(20),
  show_on_dashboard: z.boolean(),
  include_in_reports: z.boolean(),
  schedule: trackingScheduleSchema,
  provider_targets: providerTargetsSchema,
});

export type UpdateTrackingConfigValues = z.infer<
  typeof updateTrackingConfigSchema
>;

export const createCustomMetricSchema = z.object({
  custom_label: z
    .string()
    .trim()
    .min(2, "Metric name must be at least 2 characters.")
    .max(60, "Metric name must be 60 characters or fewer."),
  unit: z.string().trim().min(1, "Unit is required.").max(20),
  show_on_dashboard: z.boolean().default(true),
  include_in_reports: z.boolean().default(true),
  schedule: trackingScheduleSchema.default({
    contexts: ["Daily"],
    slots: [
      {
        id: "custom-default",
        context: "Daily",
        time: "09:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
    ],
  }),
  provider_targets: providerTargetsSchema,
});

export type CreateCustomMetricValues = z.infer<typeof createCustomMetricSchema>;

export const GLUCOSE_CONTEXT_PRESETS = [
  "Fasting",
  "Before breakfast",
  "After breakfast",
  "Before lunch",
  "After lunch",
  "Before dinner",
  "After dinner",
  "Custom",
] as const;

export const BLOOD_PRESSURE_CONTEXT_PRESETS = [
  "Morning",
  "Afternoon",
  "Evening",
  "Custom",
] as const;

export const WEIGHT_CONTEXT_PRESETS = ["Morning", "Evening", "Custom"] as const;

export const SUPPORTED_UNITS_BY_METRIC: Record<string, string[]> = {
  glucose: ["mg/dL", "mmol/L"],
  blood_pressure: ["mmHg"],
  weight: ["kg", "lb"],
};

export interface DefaultTrackingSeed {
  metric_type: "glucose" | "blood_pressure" | "weight";
  enabled: boolean;
  unit: string;
  show_on_dashboard: boolean;
  include_in_reports: boolean;
  schedule: Json;
  provider_targets: null;
}

export const DEFAULT_TRACKING_SEEDS: DefaultTrackingSeed[] = [
  {
    metric_type: "glucose",
    enabled: true,
    unit: "mg/dL",
    show_on_dashboard: true,
    include_in_reports: true,
    schedule: {
      contexts: ["Fasting", "After breakfast", "After lunch", "After dinner"],
      slots: [
        {
          id: "glucose-fasting",
          context: "Fasting",
          time: "07:30",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        {
          id: "glucose-breakfast",
          context: "After breakfast",
          time: "09:30",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          postMealMinutes: 60,
        },
        {
          id: "glucose-lunch",
          context: "After lunch",
          time: "13:30",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          postMealMinutes: 60,
        },
        {
          id: "glucose-dinner",
          context: "After dinner",
          time: "20:30",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          postMealMinutes: 60,
        },
      ],
    },
    provider_targets: null,
  },
  {
    metric_type: "blood_pressure",
    enabled: true,
    unit: "mmHg",
    show_on_dashboard: true,
    include_in_reports: true,
    schedule: {
      contexts: ["Morning", "Evening"],
      slots: [
        {
          id: "bp-morning",
          context: "Morning",
          time: "08:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
      ],
    },
    provider_targets: null,
  },
  {
    metric_type: "weight",
    enabled: true,
    unit: "kg",
    show_on_dashboard: true,
    include_in_reports: true,
    schedule: {
      contexts: ["Morning"],
      slots: [
        {
          id: "weight-morning",
          context: "Morning",
          time: "07:45",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
      ],
    },
    provider_targets: null,
  },
];
