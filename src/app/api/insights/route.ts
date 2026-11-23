import { getInsightsData } from "@/features/insights/service";
import type {
  DateRangePreset,
  GlucoseContextFilter,
} from "@/lib/calculations/analytics";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import type { MetricType } from "@/types/database";

const VALID_PRESETS: DateRangePreset[] = ["7d", "14d", "30d", "custom"];
const VALID_GLUCOSE_FILTERS: GlucoseContextFilter[] = [
  "all",
  "fasting",
  "before_meals",
  "after_meals",
  "breakfast",
  "lunch",
  "dinner",
];
const VALID_METRICS: Array<MetricType | "all"> = [
  "all",
  "glucose",
  "blood_pressure",
  "weight",
  "custom",
];

export async function GET(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { searchParams } = new URL(request.url);
  const rawPreset = searchParams.get("range");
  const rawGlucoseFilter = searchParams.get("glucoseContext");
  const rawMetric = searchParams.get("metric");

  const preset: DateRangePreset =
    rawPreset && VALID_PRESETS.includes(rawPreset as DateRangePreset)
      ? (rawPreset as DateRangePreset)
      : "14d";
  const glucoseContext: GlucoseContextFilter =
    rawGlucoseFilter &&
    VALID_GLUCOSE_FILTERS.includes(rawGlucoseFilter as GlucoseContextFilter)
      ? (rawGlucoseFilter as GlucoseContextFilter)
      : "all";
  const historyMetric: MetricType | "all" =
    rawMetric && VALID_METRICS.includes(rawMetric as MetricType | "all")
      ? (rawMetric as MetricType | "all")
      : "all";

  try {
    const data = await getInsightsData(supabase, user.id, {
      preset,
      customStart: searchParams.get("start"),
      customEnd: searchParams.get("end"),
      glucoseContext,
      historyMetric,
      search: searchParams.get("search") ?? undefined,
    });
    return apiSuccess(data);
  } catch {
    return apiError("FETCH_FAILED", "Couldn't load insights data.", 500);
  }
}
