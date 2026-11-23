import { reminderSchema } from "@/features/reminders/schemas";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = reminderSchema.partial().safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid reminder update.",
      400
    );
  }

  const { data, error } = await supabase
    .from("reminders")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return apiError("UPDATE_FAILED", "Couldn't update reminder.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Reminder not found.", 404);
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
    .from("reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return apiError("DELETE_FAILED", "Couldn't delete reminder.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Reminder not found.", 404);
  }

  return apiSuccess({ id });
}
