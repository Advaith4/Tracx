import { pushSubscriptionSchema } from "@/features/reminders/schemas";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = pushSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid push subscription.",
      400
    );
  }

  const values = parsed.data;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: values.endpoint,
        p256dh: values.keys.p256dh,
        auth: values.keys.auth,
        device_label: values.device_label ?? null,
        revoked_at: null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    )
    .select("id, endpoint, device_label, created_at")
    .single();

  if (error || !data) {
    return apiError(
      "SUBSCRIBE_FAILED",
      "Couldn't save push notification subscription.",
      500
    );
  }

  return apiSuccess(data, 201);
}

export async function DELETE(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const endpoint =
    body && typeof body.endpoint === "string" ? body.endpoint : null;

  const query = supabase
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id);

  const { error } = endpoint
    ? await query.eq("endpoint", endpoint)
    : await query.is("revoked_at", null);

  if (error) {
    return apiError("REVOKE_FAILED", "Couldn't revoke push subscription.", 500);
  }

  return apiSuccess({ revoked: true });
}
