import { generateText } from "ai";
import { getInsightsData } from "@/features/insights/service";
import { getDashboardData } from "@/features/measurements/service";
import { buildDataAssistantSystemPrompt } from "@/lib/ai/prompts/data-assistant";
import { resolveAiModel } from "@/lib/ai/providers";
import {
  checkAiRateLimit,
  detectUrgentSymptomMention,
  URGENT_CARE_GUIDANCE,
} from "@/lib/ai/safety";
import { chatRequestSchema } from "@/lib/ai/schemas";
import type { DateRangePreset } from "@/lib/calculations/analytics";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

function inferPresetFromMessage(
  message: string,
  fallback: DateRangePreset
): DateRangePreset {
  const lower = message.toLowerCase();
  if (lower.includes("30 day") || lower.includes("month")) return "30d";
  if (lower.includes("7 day") || lower.includes("week")) return "7d";
  return fallback;
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const rateLimit = checkAiRateLimit(user.id);
  if (!rateLimit.allowed) {
    return apiError(
      "RATE_LIMITED",
      `Too many assistant requests. Please wait ${rateLimit.retryAfterSeconds}s and try again.`,
      429
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Please enter a valid question.",
      400
    );
  }

  if (detectUrgentSymptomMention(parsed.data.message)) {
    return apiSuccess({
      answer: URGENT_CARE_GUIDANCE,
      sourcePeriod: null,
      limitations:
        "Emergency or symptom evaluation is outside the scope of Tracx.",
    });
  }

  const resolvedModel = resolveAiModel();
  if (!resolvedModel.configured) {
    return apiError("AI_NOT_CONFIGURED", resolvedModel.reason, 503);
  }

  try {
    const preset = inferPresetFromMessage(
      parsed.data.message,
      parsed.data.rangePreset
    );

    const [dashboard, insights] = await Promise.all([
      getDashboardData(supabase, user.id, user.email),
      getInsightsData(supabase, user.id, {
        preset,
        glucoseContext: "all",
      }),
    ]);

    const factualContext = {
      todayDate: dashboard.todayDate,
      timezone: dashboard.timezone,
      todayTasks: dashboard.tasks.map((t) => ({
        measurement: t.measurementName,
        context: t.context,
        scheduledTime: t.scheduledTime,
        status: t.status,
        recordedValue: t.recordedValue ?? null,
      })),
      period: {
        startDate: insights.startDate,
        endDate: insights.endDate,
      },
      deterministicStats: {
        glucoseUnit: insights.glucose.unit,
        glucoseBreakdowns: insights.glucose.breakdowns,
        bloodPressure: {
          count: insights.bloodPressure.count,
          systolic: insights.bloodPressure.systolic,
          diastolic: insights.bloodPressure.diastolic,
          pulse: insights.bloodPressure.pulse,
        },
        weight: {
          unit: insights.weight.unit,
          stats: insights.weight.stats,
        },
        completion: insights.completion,
      },
      records: insights.history.slice(0, 35).map((r) => ({
        metric: r.metricLabel,
        value: r.displayValue,
        context: r.contextLabel,
        measuredAt: r.measuredAtLabel,
        notes: r.notes,
      })),
    };

    const result = await generateText({
      model: resolvedModel.model,
      system: buildDataAssistantSystemPrompt(),
      prompt: `User question: ${parsed.data.message}

Retrieved factual records & deterministic statistics (JSON):
${JSON.stringify(factualContext)}`,
    });

    const limitations =
      insights.history.length === 0
        ? `No measurements recorded between ${insights.startDate} and ${insights.endDate}.`
        : `Based on ${insights.history.length} recorded measurement(s) from ${insights.startDate} to ${insights.endDate} (${insights.timezone}). Tracx does not provide medical diagnosis or targets.`;

    return apiSuccess({
      answer: result.text,
      sourcePeriod: {
        startDate: insights.startDate,
        endDate: insights.endDate,
      },
      limitations,
    });
  } catch {
    return apiError(
      "AI_SERVICE_ERROR",
      "The assistant is temporarily unavailable. You can inspect all your records directly in Insights.",
      502
    );
  }
}
