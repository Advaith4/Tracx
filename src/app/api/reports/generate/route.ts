import { generateReportRequestSchema } from "@/features/weekly-reports/schemas";
import { generateAndSaveWeeklyReport } from "@/features/weekly-reports/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = generateReportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid report period.",
      400
    );
  }

  try {
    const result = await generateAndSaveWeeklyReport({
      supabase,
      userId: user.id,
      userEmail: user.email,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      sendEmail: parsed.data.sendEmail,
    });
    return apiSuccess(result, 201);
  } catch {
    return apiError("GENERATE_FAILED", "Couldn't generate weekly report.", 500);
  }
}
