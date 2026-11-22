import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { customMetricRecordSchema } from "@/lib/validation/measurements";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = customMetricRecordSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "The custom measurement is invalid.",
      400
    );
  }

  const values = parsed.data;
  const { data: config } = await supabase
    .from("tracking_configs")
    .select("id, unit")
    .eq("id", values.metric_config_id)
    .eq("user_id", user.id)
    .eq("metric_type", "custom")
    .maybeSingle();

  if (!config) {
    return apiError("NOT_FOUND", "Custom metric configuration not found.", 404);
  }

  const { data, error } = await supabase
    .from("custom_metric_records")
    .insert({
      user_id: user.id,
      metric_config_id: config.id,
      value_numeric: values.value_numeric ?? null,
      value_text: values.value_text?.trim() || null,
      unit: values.unit?.trim() || config.unit,
      measured_at: values.measured_at,
      entered_at: new Date().toISOString(),
      notes: values.notes?.trim() || null,
      source: values.source,
    })
    .select("*")
    .single();

  if (error || !data) {
    return apiError("CREATE_FAILED", "Couldn't save custom measurement.", 500);
  }

  return apiSuccess(data, 201);
}
