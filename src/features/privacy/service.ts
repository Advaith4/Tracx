import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Tables } from "@/types/database";

export const accountDeleteSchema = z.object({
  confirmation: z.literal("DELETE"),
});

export interface ExportedPushSubscriptionMetadata {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface PrivacyExportBundle {
  exportedAt: string;
  schemaVersion: 1;
  account: {
    id: string;
    email: string | null;
  };
  profile: Tables<"profiles"> | null;
  trackingConfigs: Tables<"tracking_configs">[];
  measurements: {
    glucose: Tables<"glucose_records">[];
    bloodPressure: Tables<"blood_pressure_records">[];
    weight: Tables<"weight_records">[];
    custom: Tables<"custom_metric_records">[];
  };
  skips: Tables<"measurement_skips">[];
  dailyNotes: Tables<"daily_notes">[];
  reminders: Tables<"reminders">[];
  notificationLogs: Tables<"notification_logs">[];
  pushSubscriptions: ExportedPushSubscriptionMetadata[];
  weeklyReports: Tables<"weekly_reports">[];
}

export function sanitizePushSubscriptionForExport(
  sub: Tables<"push_subscriptions">
): ExportedPushSubscriptionMetadata {
  return {
    id: sub.id,
    device_label: sub.device_label,
    created_at: sub.created_at,
    last_used_at: sub.last_used_at,
    revoked_at: sub.revoked_at,
  };
}

export function buildPrivacyExportPayload(input: {
  exportedAt?: string;
  userId: string;
  email: string | null;
  profile: Tables<"profiles"> | null;
  trackingConfigs: Tables<"tracking_configs">[];
  glucose: Tables<"glucose_records">[];
  bloodPressure: Tables<"blood_pressure_records">[];
  weight: Tables<"weight_records">[];
  custom: Tables<"custom_metric_records">[];
  skips: Tables<"measurement_skips">[];
  dailyNotes: Tables<"daily_notes">[];
  reminders: Tables<"reminders">[];
  notificationLogs: Tables<"notification_logs">[];
  pushSubscriptions: Tables<"push_subscriptions">[];
  weeklyReports: Tables<"weekly_reports">[];
}): PrivacyExportBundle {
  return {
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    schemaVersion: 1,
    account: {
      id: input.userId,
      email: input.email,
    },
    profile: input.profile,
    trackingConfigs: input.trackingConfigs,
    measurements: {
      glucose: input.glucose,
      bloodPressure: input.bloodPressure,
      weight: input.weight,
      custom: input.custom,
    },
    skips: input.skips,
    dailyNotes: input.dailyNotes,
    reminders: input.reminders,
    notificationLogs: input.notificationLogs,
    pushSubscriptions: input.pushSubscriptions.map(
      sanitizePushSubscriptionForExport
    ),
    weeklyReports: input.weeklyReports,
  };
}

export async function exportUserHealthData(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string | null
): Promise<PrivacyExportBundle> {
  const [
    profileRes,
    configsRes,
    glucoseRes,
    bpRes,
    weightRes,
    customRes,
    skipsRes,
    notesRes,
    remindersRes,
    logsRes,
    pushRes,
    reportsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("tracking_configs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("glucose_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false }),
    supabase
      .from("blood_pressure_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false }),
    supabase
      .from("weight_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false }),
    supabase
      .from("custom_metric_records")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false }),
    supabase
      .from("measurement_skips")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("daily_notes")
      .select("*")
      .eq("user_id", userId)
      .order("note_date", { ascending: false }),
    supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("notification_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", userId)
      .order("week_start_date", { ascending: false }),
  ]);

  const errors = [
    profileRes.error,
    configsRes.error,
    glucoseRes.error,
    bpRes.error,
    weightRes.error,
    customRes.error,
    skipsRes.error,
    notesRes.error,
    remindersRes.error,
    logsRes.error,
    pushRes.error,
    reportsRes.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to export health records.");
  }

  return buildPrivacyExportPayload({
    userId,
    email,
    profile: profileRes.data ?? null,
    trackingConfigs: configsRes.data ?? [],
    glucose: glucoseRes.data ?? [],
    bloodPressure: bpRes.data ?? [],
    weight: weightRes.data ?? [],
    custom: customRes.data ?? [],
    skips: skipsRes.data ?? [],
    dailyNotes: notesRes.data ?? [],
    reminders: remindersRes.data ?? [],
    notificationLogs: logsRes.data ?? [],
    pushSubscriptions: pushRes.data ?? [],
    weeklyReports: reportsRes.data ?? [],
  });
}
