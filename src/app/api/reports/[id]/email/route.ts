import {
  generateWeeklyReportEmail,
  hydrateWeeklyReport,
} from "@/features/weekly-reports/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  if (!user.email) {
    return apiError("NO_EMAIL", "No registered email address on account.", 400);
  }

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

  const result = await generateWeeklyReportEmail({
    to: user.email,
    report: hydrateWeeklyReport(data),
  });

  if (!result.sent) {
    return apiError(
      "EMAIL_FAILED",
      result.error ?? "Couldn't email weekly report.",
      503
    );
  }

  return apiSuccess({ sent: true, to: user.email });
}
