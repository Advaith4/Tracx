import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { weightRecordSchema } from "@/lib/validation/measurements";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = weightRecordSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "The weight reading is invalid.",
      400
    );
  }

  const values = parsed.data;
  const { data, error } = await supabase
    .from("weight_records")
    .update({
      value: values.value,
      unit: values.unit,
      measured_at: values.measured_at,
      notes: values.notes?.trim() || null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return apiError("UPDATE_FAILED", "Couldn't update weight reading.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Weight reading not found.", 404);
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
    .from("weight_records")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return apiError("DELETE_FAILED", "Couldn't delete weight reading.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Weight reading not found.", 404);
  }

  return apiSuccess({ id });
}
