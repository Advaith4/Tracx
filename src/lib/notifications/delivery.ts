import { Resend } from "resend";
import { sendNotification, setVapidDetails } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocalDateString, safeTimezone } from "@/lib/calculations/daily-status";
import {
  buildPrivacySafeNotificationCopy,
  evaluateReminderDueState,
} from "@/lib/notifications/reminder-logic";
import type { Database, Tables } from "@/types/database";

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@tracx.app";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export async function sendWebPushNotification(params: {
  supabase: SupabaseClient<Database>;
  subscription: Tables<"push_subscriptions">;
  title: string;
  body: string;
  url?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const vapid = getVapidConfig();
  if (!vapid) {
    return { ok: false, error: "Web Push VAPID keys are not configured." };
  }

  setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  try {
    await sendNotification(
      {
        endpoint: params.subscription.endpoint,
        keys: {
          p256dh: params.subscription.p256dh,
          auth: params.subscription.auth,
        },
      },
      JSON.stringify({
        title: params.title,
        body: params.body,
        url: params.url ?? "/log",
      })
    );

    await params.supabase
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", params.subscription.id);

    return { ok: true };
  } catch (err) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0;

    if (statusCode === 404 || statusCode === 410) {
      await params.supabase
        .from("push_subscriptions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", params.subscription.id);
    }

    return { ok: false, error: "Push delivery failed." };
  }
}

export async function sendReminderEmail(params: {
  to: string;
  title: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() || "Tracx <onboarding@resend.dev>";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.title,
      text: `${params.body}\n\nOpen Tracx to record your measurement.`,
    });

    if (error) {
      return {
        ok: false,
        error: `Email provider error: ${error.message || "Check RESEND_API_KEY configuration."}`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Email delivery failed." };
  }
}

export async function processDueRemindersForUser(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  userEmail?: string | null;
  referenceDate?: Date;
}) {
  const now = params.referenceDate ?? new Date();
  const sinceIso = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();

  const [
    remindersRes,
    logsRes,
    glucoseRes,
    bpRes,
    weightRes,
    customRes,
    profileRes,
    subsRes,
  ] = await Promise.all([
    params.supabase
      .from("reminders")
      .select("*")
      .eq("user_id", params.userId)
      .eq("enabled", true),
    params.supabase
      .from("notification_logs")
      .select("*")
      .eq("user_id", params.userId)
      .gte("scheduled_for", sinceIso),
    params.supabase
      .from("glucose_records")
      .select("measured_at")
      .eq("user_id", params.userId)
      .gte("measured_at", sinceIso),
    params.supabase
      .from("blood_pressure_records")
      .select("measured_at")
      .eq("user_id", params.userId)
      .gte("measured_at", sinceIso),
    params.supabase
      .from("weight_records")
      .select("measured_at")
      .eq("user_id", params.userId)
      .gte("measured_at", sinceIso),
    params.supabase
      .from("custom_metric_records")
      .select("measured_at")
      .eq("user_id", params.userId)
      .gte("measured_at", sinceIso),
    params.supabase
      .from("profiles")
      .select("timezone")
      .eq("id", params.userId)
      .maybeSingle(),
    params.supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", params.userId)
      .is("revoked_at", null),
  ]);

  const reminders = remindersRes.data ?? [];
  const logs = logsRes.data ?? [];
  const activeSubs = subsRes.data ?? [];
  const profileTz = safeTimezone(profileRes.data?.timezone);

  const dispatched: Array<{ reminderId: string; status: string }> = [];

  for (const reminder of reminders) {
    const tz = safeTimezone(reminder.timezone || profileTz);
    const todayDate = getLocalDateString(now, tz);

    const completedToday = new Set<string>();
    if (
      (glucoseRes.data ?? []).some(
        (r) => getLocalDateString(new Date(r.measured_at), tz) === todayDate
      )
    ) {
      completedToday.add("glucose");
    }
    if (
      (bpRes.data ?? []).some(
        (r) => getLocalDateString(new Date(r.measured_at), tz) === todayDate
      )
    ) {
      completedToday.add("blood_pressure");
    }
    if (
      (weightRes.data ?? []).some(
        (r) => getLocalDateString(new Date(r.measured_at), tz) === todayDate
      )
    ) {
      completedToday.add("weight");
    }
    if (
      (customRes.data ?? []).some(
        (r) => getLocalDateString(new Date(r.measured_at), tz) === todayDate
      )
    ) {
      completedToday.add("custom");
    }

    const reminderLogs = logs.filter((l) => l.reminder_id === reminder.id);
    const evaluation = evaluateReminderDueState({
      reminder,
      referenceDate: now,
      completedMetricTypesToday: completedToday,
      todayLogsForReminder: reminderLogs,
    });

    if (!evaluation.shouldSendInitial && !evaluation.shouldSendFollowUp) {
      continue;
    }

    const copy = buildPrivacySafeNotificationCopy(reminder, false);
    let deliveryStatus: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;

    if (reminder.channel === "push") {
      if (activeSubs.length === 0) {
        deliveryStatus = "failed";
        errorMessage = "No active browser push subscription.";
      } else {
        const results = await Promise.all(
          activeSubs.map((sub) =>
            sendWebPushNotification({
              supabase: params.supabase,
              subscription: sub,
              title: copy.title,
              body: copy.body,
              url: `/log?metric=${reminder.metric_type}`,
            })
          )
        );
        if (!results.some((r) => r.ok)) {
          deliveryStatus = "failed";
          errorMessage = results[0]?.error ?? "Push delivery failed.";
        }
      }
    } else if (reminder.channel === "email") {
      if (!params.userEmail) {
        deliveryStatus = "failed";
        errorMessage = "No user email available.";
      } else {
        const res = await sendReminderEmail({
          to: params.userEmail,
          title: copy.title,
          body: copy.body,
        });
        if (!res.ok) {
          deliveryStatus = "failed";
          errorMessage = res.error ?? "Email delivery failed.";
        }
      }
    }

    await params.supabase.from("notification_logs").insert({
      user_id: params.userId,
      reminder_id: reminder.id,
      scheduled_for: now.toISOString(),
      sent_at: deliveryStatus === "sent" ? now.toISOString() : null,
      channel: reminder.channel,
      status: deliveryStatus,
      error_message: errorMessage,
    });

    dispatched.push({ reminderId: reminder.id, status: deliveryStatus });
  }

  return dispatched;
}
