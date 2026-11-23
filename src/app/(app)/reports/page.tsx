import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import { ReportsWorkspace } from "@/features/weekly-reports/components/reports-workspace";
import { hydrateWeeklyReport } from "@/features/weekly-reports/service";
import { getDefaultWeeklyPeriod } from "@/lib/calculations/weekly-report";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedReports() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/reports");
  }

  const [profileRes, reportsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(24),
  ]);

  const defaults = getDefaultWeeklyPeriod(profileRes.data?.timezone ?? "UTC");
  const initialReports = (reportsRes.data ?? []).map(hydrateWeeklyReport);

  return (
    <ReportsWorkspace
      userId={user.id}
      defaultPeriodStart={defaults.periodStart}
      defaultPeriodEnd={defaults.periodEnd}
      initialReports={initialReports}
    />
  );
}

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate weekly tracking summaries, download PDFs, and email copies
          when needed.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={3} />}>
        <AuthenticatedReports />
      </Suspense>
    </div>
  );
}
