import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { bloodPressureRecordSchema } from "@/lib/validation/measurements";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = bloodPressureRecordSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "The blood pressure reading is invalid.",
      400
    );
  }

  const values = parsed.data;
  const { data, error } = await supabase
    .from("blood_pressure_records")
    .update({
      systolic: values.systolic,
      diastolic: values.diastolic,
      pulse: values.pulse ?? null,
      measured_at: values.measured_at,
      notes: values.notes?.trim() || null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return apiError(
      "UPDATE_FAILED",
      "Couldn't update blood pressure reading.",
      500
    );
  }
  if (!data) {
    return apiError("NOT_FOUND", "Blood pressure reading not found.", 404);
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
    .from("blood_pressure_records")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return apiError(
      "DELETE_FAILED",
      "Couldn't delete blood pressure reading.",
      500
    );
  }
  if (!data) {
    return apiError("NOT_FOUND", "Blood pressure reading not found.", 404);
  }

  return apiSuccess({ id });
}
