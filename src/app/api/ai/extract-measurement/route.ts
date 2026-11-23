import { generateText, Output } from "ai";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import { buildExtractionSystemPrompt } from "@/lib/ai/prompts/extraction";
import {
  resolveAiModelCandidates,
  runWithAiFallback,
} from "@/lib/ai/providers";
import {
  checkAiRateLimit,
  detectUrgentSymptomMention,
  URGENT_CARE_GUIDANCE,
} from "@/lib/ai/safety";
import {
  extractedMeasurementResponseSchema,
  extractRequestSchema,
} from "@/lib/ai/schemas";
import { safeTimezone } from "@/lib/calculations/daily-status";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const rateLimit = checkAiRateLimit(user.id);
  if (!rateLimit.allowed) {
    return apiError(
      "RATE_LIMITED",
      `Too many AI requests. Please wait ${rateLimit.retryAfterSeconds}s or log manually.`,
      429
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = extractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid extraction input.",
      400
    );
  }

  if (detectUrgentSymptomMention(parsed.data.text)) {
    return apiSuccess({
      records: [],
      needs_clarification: true,
      clarification_question: URGENT_CARE_GUIDANCE,
      missing_fields: [],
    });
  }

  const resolvedModels = resolveAiModelCandidates();
  if (!resolvedModels.configured) {
    return apiError("AI_NOT_CONFIGURED", resolvedModels.reason, 503);
  }

  try {
    const [{ data: profile }, configs] = await Promise.all([
      supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .maybeSingle(),
      ensureAndListTrackingConfigs(supabase, user.id),
    ]);

    const timezone = safeTimezone(parsed.data.timezone ?? profile?.timezone);
    const localNowIso = parsed.data.localNowIso || new Date().toISOString();
    const defaultGlucoseUnit =
      configs.find((c) => c.metric_type === "glucose")?.unit ?? "mg/dL";
    const defaultWeightUnit =
      configs.find((c) => c.metric_type === "weight")?.unit ?? "kg";

    const { result } = await runWithAiFallback(
      resolvedModels.candidates,
      (model) =>
        generateText({
          model,
          output: Output.object({
            schema: extractedMeasurementResponseSchema,
          }),
          system: buildExtractionSystemPrompt({
            localNowIso,
            timezone,
            defaultGlucoseUnit,
            defaultWeightUnit,
          }),
          prompt: parsed.data.text,
        })
    );

    const validated = extractedMeasurementResponseSchema.safeParse(
      result.output
    );
    if (!validated.success) {
      return apiError(
        "EXTRACTION_INVALID",
        "Couldn't extract a valid measurement. Please try rephrasing or enter manually.",
        422
      );
    }

    return apiSuccess(validated.data);
  } catch {
    return apiError(
      "AI_SERVICE_ERROR",
      "Voice extraction is temporarily unavailable. You can still enter measurements manually.",
      502
    );
  }
}
