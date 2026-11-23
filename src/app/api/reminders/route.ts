import { reminderSchema } from "@/features/reminders/schemas";
import {
  encodeReminderMetricType,
  getWeekdayFromDateString,
  parseReminderMetricMeta,
} from "@/lib/notifications/reminder-logic";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", user.id)
    .order("scheduled_time", { ascending: true });

  if (error) {
    return apiError("FETCH_FAILED", "Couldn't load reminders.", 500);
  }

  return apiSuccess(data ?? []);
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = reminderSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid reminder settings.",
      400
    );
  }

  const values = parsed.data;
  const encodedMetricType = encodeReminderMetricType(
    values.metric_type,
    values.scheduled_date
  );
  const { scheduledDate } = parseReminderMetricMeta(encodedMetricType);
  const resolvedDaysOfWeek = scheduledDate
    ? [getWeekdayFromDateString(scheduledDate)]
    : values.days_of_week;

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      metric_type: encodedMetricType,
      label: values.label,
      scheduled_time: values.scheduled_time,
      timezone: values.timezone,
      days_of_week: resolvedDaysOfWeek,
      channel: values.channel,
      enabled: values.enabled,
      follow_up_minutes: values.follow_up_minutes ?? null,
      snooze_minutes: values.snooze_minutes,
      quiet_hours_start: values.quiet_hours_start ?? null,
      quiet_hours_end: values.quiet_hours_end ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return apiError("CREATE_FAILED", "Couldn't create reminder.", 500);
  }

  return apiSuccess(data, 201);
}
