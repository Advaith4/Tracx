import { hydrateWeeklyReport } from "@/features/weekly-reports/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return apiError("FETCH_FAILED", "Couldn't load weekly report.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Weekly report not found.", 404);
  }

  return apiSuccess(hydrateWeeklyReport(data));
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("weekly_reports")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return apiError("DELETE_FAILED", "Couldn't delete weekly report.", 500);
  }
  if (!data) {
    return apiError("NOT_FOUND", "Weekly report not found.", 404);
  }

  return apiSuccess({ id });
}
