import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { skipMeasurementSchema } from "@/lib/validation/measurements";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = skipMeasurementSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid skip request.",
      400
    );
  }

  const values = parsed.data;
  const { data, error } = await supabase
    .from("measurement_skips")
    .insert({
      user_id: user.id,
      metric_type: values.metric_type,
      tracking_config_id: values.tracking_config_id ?? null,
      scheduled_date: values.scheduled_date,
      context_label: values.context_label?.trim() || null,
      reason: values.reason?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return apiError("CREATE_FAILED", "Couldn't mark measurement as skipped.", 500);
  }

  return apiSuccess(data, 201);
}
