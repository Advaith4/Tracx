import { hydrateWeeklyReport } from "@/features/weekly-reports/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(24);

  if (error) {
    return apiError("FETCH_FAILED", "Couldn't load weekly reports.", 500);
  }

  return apiSuccess((data ?? []).map(hydrateWeeklyReport));
}
