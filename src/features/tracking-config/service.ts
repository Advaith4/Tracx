import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { DEFAULT_TRACKING_SEEDS } from "./schemas";

const METRIC_SORT_ORDER: Record<string, number> = {
  glucose: 0,
  blood_pressure: 1,
  weight: 2,
  custom: 3,
};

export function sortTrackingConfigs(
  configs: Tables<"tracking_configs">[]
): Tables<"tracking_configs">[] {
  return [...configs].sort((a, b) => {
    const orderDiff =
      (METRIC_SORT_ORDER[a.metric_type] ?? 99) -
      (METRIC_SORT_ORDER[b.metric_type] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return a.created_at.localeCompare(b.created_at);
  });
}

export async function ensureAndListTrackingConfigs(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Tables<"tracking_configs">[]> {
  const { data: existing, error } = await supabase
    .from("tracking_configs")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  if (existing && existing.length > 0) {
    return sortTrackingConfigs(existing);
  }

  const seedsToInsert = DEFAULT_TRACKING_SEEDS.map((seed) => ({
    ...seed,
    user_id: userId,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("tracking_configs")
    .insert(seedsToInsert)
    .select("*");

  if (insertError) {
    throw new Error(insertError.message);
  }

  return sortTrackingConfigs(inserted ?? []);
}
