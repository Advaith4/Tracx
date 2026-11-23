import { getCalendarMonthData } from "@/features/calendar/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;

  try {
    const data = await getCalendarMonthData(supabase, user.id, { month });
    return apiSuccess(data);
  } catch {
    return apiError(
      "CALENDAR_FETCH_FAILED",
      "Couldn't load calendar data.",
      500
    );
  }
}
