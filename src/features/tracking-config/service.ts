import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { DEFAULT_TRACKING_SEEDS } from "./schemas";

const METRIC_SORT_ORDER: Record<string, number> = {
  glucose: 0,
  blood_pressure: 1,
  weight: 2,
  custom: 3,
};

const BUILTIN_METRICS = new Set(["glucose", "blood_pressure", "weight"]);
const seedInFlight = new Map<string, Promise<Tables<"tracking_configs">[]>>();

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

export function deduplicateTrackingConfigs(
  configs: Tables<"tracking_configs">[]
): {
  unique: Tables<"tracking_configs">[];
  duplicateIds: string[];
} {
  const sorted = sortTrackingConfigs(configs);
  const seenBuiltin = new Set<string>();
  const unique: Tables<"tracking_configs">[] = [];
  const duplicateIds: string[] = [];

  for (const config of sorted) {
    if (BUILTIN_METRICS.has(config.metric_type)) {
      if (seenBuiltin.has(config.metric_type)) {
        duplicateIds.push(config.id);
        continue;
      }
      seenBuiltin.add(config.metric_type);
    }
    unique.push(config);
  }

  return { unique, duplicateIds };
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
    const { unique, duplicateIds } = deduplicateTrackingConfigs(existing);
    if (duplicateIds.length > 0) {
      await supabase
        .from("tracking_configs")
        .delete()
        .eq("user_id", userId)
        .in("id", duplicateIds);
    }
    return unique;
  }

  const inflight = seedInFlight.get(userId);
  if (inflight) {
    return inflight;
  }

  const seedPromise = (async () => {
    const { data: recheck } = await supabase
      .from("tracking_configs")
      .select("*")
      .eq("user_id", userId);

    if (recheck && recheck.length > 0) {
      return deduplicateTrackingConfigs(recheck).unique;
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

    return deduplicateTrackingConfigs(inserted ?? []).unique;
  })().finally(() => {
    seedInFlight.delete(userId);
  });

  seedInFlight.set(userId, seedPromise);
  return seedPromise;
}
