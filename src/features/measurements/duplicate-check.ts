import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  GlucoseUnit,
  MealContext,
  WeightUnit,
} from "@/types/database";

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

function getWindowBounds(measuredAtIso: string) {
  const ms = new Date(measuredAtIso).getTime();
  return {
    from: new Date(ms - DUPLICATE_WINDOW_MS).toISOString(),
    to: new Date(ms + DUPLICATE_WINDOW_MS).toISOString(),
  };
}

export async function hasPotentialGlucoseDuplicate(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: {
    value: number;
    unit: GlucoseUnit;
    meal_context: MealContext;
    measured_at: string;
  }
): Promise<boolean> {
  const { from, to } = getWindowBounds(params.measured_at);
  const { data } = await supabase
    .from("glucose_records")
    .select("id")
    .eq("user_id", userId)
    .eq("value", params.value)
    .eq("unit", params.unit)
    .eq("meal_context", params.meal_context)
    .gte("measured_at", from)
    .lte("measured_at", to)
    .limit(1);

  return Boolean(data && data.length > 0);
}

export async function hasPotentialBpDuplicate(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: {
    systolic: number;
    diastolic: number;
    measured_at: string;
  }
): Promise<boolean> {
  const { from, to } = getWindowBounds(params.measured_at);
  const { data } = await supabase
    .from("blood_pressure_records")
    .select("id")
    .eq("user_id", userId)
    .eq("systolic", params.systolic)
    .eq("diastolic", params.diastolic)
    .gte("measured_at", from)
    .lte("measured_at", to)
    .limit(1);

  return Boolean(data && data.length > 0);
}

export async function hasPotentialWeightDuplicate(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: {
    value: number;
    unit: WeightUnit;
    measured_at: string;
  }
): Promise<boolean> {
  const { from, to } = getWindowBounds(params.measured_at);
  const { data } = await supabase
    .from("weight_records")
    .select("id")
    .eq("user_id", userId)
    .eq("value", params.value)
    .eq("unit", params.unit)
    .gte("measured_at", from)
    .lte("measured_at", to)
    .limit(1);

  return Boolean(data && data.length > 0);
}
