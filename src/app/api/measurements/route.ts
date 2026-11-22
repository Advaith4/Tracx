import { getUnifiedMeasurements } from "@/features/measurements/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import type { MetricType } from "@/types/database";

const VALID_METRIC_TYPES: MetricType[] = [
  "glucose",
  "blood_pressure",
  "weight",
  "custom",
];

export async function GET(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { searchParams } = new URL(request.url);
  const rawMetric = searchParams.get("metricType");
  const rawLimit = Number(searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
    : 30;

  const metricType =
    rawMetric && VALID_METRIC_TYPES.includes(rawMetric as MetricType)
      ? (rawMetric as MetricType)
      : undefined;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();

    const records = await getUnifiedMeasurements(supabase, user.id, {
      limit,
      metricType,
      timezone: profile?.timezone ?? "UTC",
    });

    return apiSuccess(records);
  } catch {
    return apiError("FETCH_FAILED", "Couldn't load measurements.", 500);
  }
}
