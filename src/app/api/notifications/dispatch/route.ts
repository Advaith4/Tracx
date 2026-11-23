import { processDueRemindersForUser } from "@/lib/notifications/delivery";
import { apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function POST() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const dispatched = await processDueRemindersForUser({
    supabase,
    userId: user.id,
    userEmail: user.email,
  });

  return apiSuccess({ dispatched });
}
