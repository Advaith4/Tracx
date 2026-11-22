import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { DashboardMetricCard } from "@/components/dashboard/metric-summary-grid";
import { LoadingState } from "@/components/layout/feedback-states";
import {
  getMetricDisplayName,
  getTodayScheduledTasks,
  parseProviderTargets,
  parseSchedule,
} from "@/features/tracking-config/schedule-utils";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
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

  const [{ data: profile }, trackingConfigs] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    ensureAndListTrackingConfigs(supabase, user.id),
  ]);

  const timezone = profile?.timezone ?? "UTC";
  const tasks = getTodayScheduledTasks(trackingConfigs, timezone);

  const metricCards: DashboardMetricCard[] = trackingConfigs
    .filter((config) => config.enabled && config.show_on_dashboard)
    .map((config) => {
      const schedule = parseSchedule(config.schedule);
      const targets = parseProviderTargets(config.provider_targets);
      const contextsText =
        schedule.contexts.length > 0
          ? schedule.contexts.slice(0, 2).join(" · ")
          : "Flexible schedule";

      return {
        id: config.id,
        metricType: config.metric_type,
        label: getMetricDisplayName(config),
        latestValue: "--",
        unit: config.unit,
        context: targets?.note ? targets.note : contextsText,
        subtitle: "No readings logged yet",
      };
    });

  const fallbackName = user.email?.split("@")[0] ?? null;

  return (
    <DashboardView
      userName={profile?.display_name ?? fallbackName}
      metrics={metricCards}
      tasks={tasks}
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
