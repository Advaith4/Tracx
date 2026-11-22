import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { LoadingState } from "@/components/layout/feedback-states";
import { getDashboardData } from "@/features/measurements/service";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedDashboard() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const payload = await getDashboardData(supabase, user.id, user.email);

  return (
    <DashboardView
      userName={payload.userName}
      todayDate={payload.todayDate}
      metrics={payload.metrics}
      tasks={payload.tasks}
      recentMeasurements={payload.recentMeasurements.map((r) => ({
        id: r.id,
        type: r.metricLabel,
        value: r.displayValue,
        context: r.contextLabel,
        measuredAt: r.measuredAtLabel,
        source: r.source,
      }))}
      dailyNote={payload.dailyNote}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState rows={4} />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}
