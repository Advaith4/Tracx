import { getDashboardData } from "@/features/measurements/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  try {
    const payload = await getDashboardData(supabase, user.id, user.email);
    return apiSuccess(payload);
  } catch {
    return apiError("FETCH_FAILED", "Couldn't load dashboard data.", 500);
  }
}
