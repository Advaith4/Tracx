import {
  getLogbookData,
  type LogbookRangePreset,
} from "@/features/logbook/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

const VALID_PRESETS: LogbookRangePreset[] = [
  "7d",
  "14d",
  "30d",
  "90d",
  "all",
  "custom",
];

export async function GET(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const { searchParams } = new URL(request.url);
  const rawPreset = searchParams.get("preset") as LogbookRangePreset | null;
  const preset: LogbookRangePreset =
    rawPreset && VALID_PRESETS.includes(rawPreset) ? rawPreset : "30d";

  try {
    const data = await getLogbookData(supabase, user.id, {
      preset,
      customStart: searchParams.get("start"),
      customEnd: searchParams.get("end"),
    });
    return apiSuccess(data);
  } catch {
    return apiError("LOGBOOK_FAILED", "Couldn't load logbook sheet.", 500);
  }
}
