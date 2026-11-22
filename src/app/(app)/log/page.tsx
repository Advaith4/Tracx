import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import { LogWorkspace } from "@/features/measurements/components/log-workspace";
import { getUnifiedMeasurements } from "@/features/measurements/service";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import { createClient } from "@/lib/supabase/server";
import type { MetricType } from "@/types/database";

const VALID_METRICS: MetricType[] = [
  "glucose",
  "blood_pressure",
  "weight",
  "custom",
];

async function AuthenticatedLogContent({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; context?: string }>;
}) {
  await connection();
  const [supabase, resolvedParams] = await Promise.all([
    createClient(),
    searchParams,
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/log");
  }

  const [{ data: profile }, configs] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle(),
    ensureAndListTrackingConfigs(supabase, user.id),
  ]);

  const recentMeasurements = await getUnifiedMeasurements(supabase, user.id, {
    limit: 20,
    timezone: profile?.timezone ?? "UTC",
    configs,
  });

  const requestedMetric = resolvedParams.metric;
  const firstEnabledMetric =
    configs.find((c) => c.enabled)?.metric_type ?? "glucose";
  const initialMetric: MetricType =
    requestedMetric && VALID_METRICS.includes(requestedMetric as MetricType)
      ? (requestedMetric as MetricType)
      : firstEnabledMetric;

  return (
    <LogWorkspace
      userId={user.id}
      initialMetric={initialMetric}
      contextHint={resolvedParams.context ?? null}
      configs={configs}
      initialMeasurements={recentMeasurements}
    />
  );
}

export default function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; context?: string }>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record blood glucose, blood pressure, weight, or custom measurements.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={3} />}>
        <AuthenticatedLogContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
