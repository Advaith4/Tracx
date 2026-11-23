import { NextResponse } from "next/server";
import { hydrateWeeklyReport } from "@/features/weekly-reports/service";
import { buildWeeklyReportPdf } from "@/lib/pdf/weekly-report-pdf";
import { apiError, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { id } = await context.params;
  const [reportRes, profileRes] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (reportRes.error) {
    return apiError("FETCH_FAILED", "Couldn't load weekly report.", 500);
  }
  if (!reportRes.data) {
    return apiError("NOT_FOUND", "Weekly report not found.", 404);
  }

  const hydrated = hydrateWeeklyReport(reportRes.data);
  const pdfBytes = buildWeeklyReportPdf({
    userName: profileRes.data?.display_name ?? null,
    generatedAt: hydrated.generatedAt,
    stats: hydrated.statistics,
    narrative: hydrated.narrative,
  });

  const filename = `tracx-report-${hydrated.periodStart}-to-${hydrated.periodEnd}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
