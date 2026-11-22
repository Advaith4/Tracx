import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { customMetricRecordSchema } from "@/lib/validation/measurements";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
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
  const { data, error } = await supabase
    .from("custom_metric_records")
    .update({
      value_numeric: values.value_numeric ?? null,
      value_text: values.value_text?.trim() || null,
      unit: values.unit?.trim() || null,
      measured_at: values.measured_at,
      notes: values.notes?.trim() || null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return apiError("UPDATE_FAILED", "Couldn't update custom measurement.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Custom measurement not found.", 404);
  }

  return apiSuccess(data);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("custom_metric_records")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return apiError("DELETE_FAILED", "Couldn't delete custom measurement.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Custom measurement not found.", 404);
  }

  return apiSuccess({ id });
}
