import { hasPotentialWeightDuplicate } from "@/features/measurements/duplicate-check";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { weightRecordSchema } from "@/lib/validation/measurements";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

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
  if (!values.allowDuplicate) {
    const isDuplicate = await hasPotentialWeightDuplicate(supabase, user.id, {
      value: values.value,
      unit: values.unit,
      measured_at: values.measured_at,
    });

    if (isDuplicate) {
      return apiError(
        "POTENTIAL_DUPLICATE",
        "A similar weight reading was already recorded around this time. Save anyway?",
        409
      );
    }
  }

  const { data, error } = await supabase
    .from("weight_records")
    .insert({
      user_id: user.id,
      value: values.value,
      unit: values.unit,
      measured_at: values.measured_at,
      entered_at: new Date().toISOString(),
      notes: values.notes?.trim() || null,
      source: values.source,
    })
    .select("*")
    .single();

  if (error || !data) {
    return apiError("CREATE_FAILED", "Couldn't save weight reading.", 500);
  }

  return apiSuccess(data, 201);
}
