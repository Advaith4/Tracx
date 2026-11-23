import { z } from "zod";

const hhmmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const encodedMetricTypeRegex =
  /^(glucose|blood_pressure|weight|custom|appointment|medication)(@\d{4}-\d{2}-\d{2})?$/;

export const REMINDER_CATEGORIES = [
  "glucose",
  "blood_pressure",
  "weight",
  "appointment",
  "medication",
  "custom",
] as const;

export const reminderSchema = z.object({
  metric_type: z
    .string()
    .trim()
    .regex(encodedMetricTypeRegex, "Select a valid reminder category."),
  scheduled_date: z
    .string()
    .regex(isoDateRegex, "Use YYYY-MM-DD date format.")
    .nullable()
    .optional(),
  label: z
    .string()
    .trim()
    .min(2, "Label must be at least 2 characters.")
    .max(80, "Label must be 80 characters or fewer."),
  scheduled_time: z
    .string()
    .regex(hhmmRegex, "Use HH:MM 24-hour time format."),
  timezone: z.string().trim().min(1).default("UTC"),
  days_of_week: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Select at least one day."),
  channel: z.enum(["in_app", "push", "email"]).default("in_app"),
  enabled: z.boolean().default(true),
  follow_up_minutes: z
    .number()
    .int()
    .min(5, "Follow-up delay must be at least 5 minutes.")
    .max(240, "Follow-up delay must be 240 minutes or fewer.")
    .nullable()
    .optional(),
  snooze_minutes: z.number().int().min(5).max(120).default(15),
  quiet_hours_start: z
    .string()
    .regex(hhmmRegex, "Use HH:MM 24-hour format.")
    .nullable()
    .optional(),
  quiet_hours_end: z
    .string()
    .regex(hhmmRegex, "Use HH:MM 24-hour format.")
    .nullable()
    .optional(),
});

export type ReminderInput = z.infer<typeof reminderSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("Invalid push subscription endpoint."),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  device_label: z.string().trim().max(100).nullable().optional(),
});

export const notificationActionSchema = z.object({
  action: z.enum(["mark_read", "mark_all_read", "clear_read", "snooze"]),
  logId: z.string().uuid().optional(),
  snoozeMinutes: z.number().int().min(5).max(120).optional(),
});
