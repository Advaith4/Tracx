import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { dailyNoteSchema } from "@/lib/validation/measurements";

export async function PUT(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = dailyNoteSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Daily note is invalid.",
      400
    );
  }

  const { note_date, content } = parsed.data;

  if (!content) {
    const { error } = await supabase
      .from("daily_notes")
      .delete()
      .eq("user_id", user.id)
      .eq("note_date", note_date);

    if (error) {
      return apiError("DELETE_FAILED", "Couldn't clear daily note.", 500);
    }

    return apiSuccess({ note_date, content: "" });
  }

  const { data, error } = await supabase
    .from("daily_notes")
    .upsert(
      {
        user_id: user.id,
        note_date,
        content,
      },
      { onConflict: "user_id,note_date" }
    )
    .select("*")
    .single();

  if (error || !data) {
    return apiError("SAVE_FAILED", "Couldn't save daily note.", 500);
  }

  return apiSuccess(data);
}
