import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import { InsightsWorkspace } from "@/features/insights/components/insights-workspace";
import { getInsightsData } from "@/features/insights/service";
import { hydrateWeeklyReport } from "@/features/weekly-reports/service";
import { getDefaultWeeklyPeriod } from "@/lib/calculations/weekly-report";
import { createClient } from "@/lib/supabase/server";

const VALID_TABS = new Set([
  "overview",
  "sheet",
  "glucose",
  "blood_pressure",
  "weight",
  "custom",
  "reports",
]);

async function AuthenticatedInsights({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ tab?: string }>;
}) {
  await connection();
  const [supabase, resolvedParams] = await Promise.all([
    createClient(),
    searchParamsPromise,
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/insights");
  }

  const [initialData, reportsRes] = await Promise.all([
    getInsightsData(supabase, user.id, {
      preset: "14d",
      glucoseContext: "all",
    }),
    supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(24),
  ]);

  const defaults = getDefaultWeeklyPeriod(initialData.timezone);
  const initialReports = (reportsRes.data ?? []).map(hydrateWeeklyReport);
  const requestedTab =
    resolvedParams.tab && VALID_TABS.has(resolvedParams.tab)
      ? resolvedParams.tab
      : undefined;

  return (
    <InsightsWorkspace
      userId={user.id}
      initialData={initialData}
      initialTab={
        requestedTab as
          | "overview"
          | "sheet"
          | "glucose"
          | "blood_pressure"
          | "weight"
          | "custom"
          | "reports"
          | undefined
      }
      reportsSeed={{
        timezone: initialData.timezone,
        defaultPeriodStart: defaults.periodStart,
        defaultPeriodEnd: defaults.periodEnd,
        initialReports,
      }}
    />
  );
}

export default function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>

      <Suspense fallback={<LoadingState rows={3} />}>
        <AuthenticatedInsights searchParamsPromise={searchParams} />
      </Suspense>
    </div>
  );
}
