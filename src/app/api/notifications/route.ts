import { notificationActionSchema } from "@/features/reminders/schemas";
import { processDueRemindersForUser } from "@/lib/notifications/delivery";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  await processDueRemindersForUser({
    supabase,
    userId: user.id,
    userEmail: user.email,
  });

  const [logsRes, remindersRes] = await Promise.all([
    supabase
      .from("notification_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("reminders").select("id, label, metric_type").eq("user_id", user.id),
  ]);

  if (logsRes.error) {
    return apiError("FETCH_FAILED", "Couldn't load notifications.", 500);
  }

  const reminderMap = new Map(
    (remindersRes.data ?? []).map((r) => [r.id, r])
  );

  const items = (logsRes.data ?? []).map((log) => ({
    ...log,
    reminderLabel: log.reminder_id
      ? reminderMap.get(log.reminder_id)?.label ?? "Scheduled Check-in"
      : "Scheduled Check-in",
    metricType: log.reminder_id
      ? reminderMap.get(log.reminder_id)?.metric_type ?? "glucose"
      : "glucose",
  }));

  return apiSuccess(items);
}

export async function PATCH(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = notificationActionSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid notification action.", 400);
  }

  const { action, logId, snoozeMinutes } = parsed.data;
  const nowIso = new Date().toISOString();

  if (action === "mark_read" && logId) {
    await supabase
      .from("notification_logs")
      .update({ read_at: nowIso })
      .eq("id", logId)
      .eq("user_id", user.id);
    return apiSuccess({ updated: true });
  }

  if (action === "mark_all_read") {
    await supabase
      .from("notification_logs")
      .update({ read_at: nowIso })
      .eq("user_id", user.id)
      .is("read_at", null);
    return apiSuccess({ updated: true });
  }

  if (action === "clear_read") {
    await supabase
      .from("notification_logs")
      .delete()
      .eq("user_id", user.id)
      .not("read_at", "is", null);
    return apiSuccess({ cleared: true });
  }

  if (action === "snooze" && logId) {
    const mins = snoozeMinutes ?? 15;
    const nextIso = new Date(Date.now() + mins * 60 * 1000).toISOString();
    await supabase
      .from("notification_logs")
      .update({
        read_at: nowIso,
        status: "skipped",
        error_message: `Snoozed for ${mins} minutes (until ${nextIso})`,
      })
      .eq("id", logId)
      .eq("user_id", user.id);
    return apiSuccess({ snoozedUntil: nextIso });
  }

  return apiError("VALIDATION_ERROR", "Unsupported notification action.", 400);
}
