import { hasPotentialBpDuplicate } from "@/features/measurements/duplicate-check";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { bloodPressureRecordSchema } from "@/lib/validation/measurements";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

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
  if (!values.allowDuplicate) {
    const isDuplicate = await hasPotentialBpDuplicate(supabase, user.id, {
      systolic: values.systolic,
      diastolic: values.diastolic,
      measured_at: values.measured_at,
    });

    if (isDuplicate) {
      return apiError(
        "POTENTIAL_DUPLICATE",
        "A similar blood pressure reading was already recorded around this time. Save anyway?",
        409
      );
    }
  }

  const { data, error } = await supabase
    .from("blood_pressure_records")
    .insert({
      user_id: user.id,
      systolic: values.systolic,
      diastolic: values.diastolic,
      pulse: values.pulse ?? null,
      measured_at: values.measured_at,
      entered_at: new Date().toISOString(),
      notes: values.notes?.trim() || null,
      source: values.source,
    })
    .select("*")
    .single();

  if (error || !data) {
    return apiError(
      "CREATE_FAILED",
      "Couldn't save blood pressure reading.",
      500
    );
  }

  return apiSuccess(data, 201);
}
