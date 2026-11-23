import { generateText } from "ai";
import { getInsightsData } from "@/features/insights/service";
import { getDashboardData } from "@/features/measurements/service";
import { buildDataAssistantSystemPrompt } from "@/lib/ai/prompts/data-assistant";
import {
  resolveAiModelCandidates,
  runWithAiFallback,
} from "@/lib/ai/providers";
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

  const resolvedModels = resolveAiModelCandidates();
  if (!resolvedModels.configured) {
    return apiError("AI_NOT_CONFIGURED", resolvedModels.reason, 503);
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

    const limitations =
      insights.history.length === 0
        ? `No measurements recorded between ${insights.startDate} and ${insights.endDate}.`
        : `Based on ${insights.history.length} recorded measurement(s) from ${insights.startDate} to ${insights.endDate} (${insights.timezone}). Tracx does not provide medical diagnosis or targets.`;

    try {
      const { result } = await runWithAiFallback(
        resolvedModels.candidates,
        (model) =>
          generateText({
            model,
            system: buildDataAssistantSystemPrompt(),
            prompt: `User question: ${parsed.data.message}

Retrieved factual records & deterministic statistics (JSON):
${JSON.stringify(factualContext)}`,
          })
      );

      return apiSuccess({
        answer: result.text,
        sourcePeriod: {
          startDate: insights.startDate,
          endDate: insights.endDate,
        },
        limitations,
      });
    } catch (aiError) {
      console.error(
        "AI chat provider error:",
        aiError instanceof Error ? aiError.message : aiError
      );

      const remainingToday = dashboard.tasks.filter(
        (t) => t.status === "pending" || t.status === "upcoming"
      );
      const summaryLines = [
        "The live AI service is busy right now, so here is a direct summary from your saved records:",
        "",
        remainingToday.length > 0
          ? `Remaining today (${dashboard.todayDate}): ${remainingToday
              .map((t) => `${t.measurementName} (${t.context} at ${t.scheduledTime})`)
              .join(", ")}.`
          : `All scheduled tasks for ${dashboard.todayDate} are accounted for.`,
      ];

      if (insights.glucose.breakdowns.fasting.count > 0) {
        summaryLines.push(
          `Fasting glucose (${insights.startDate} to ${insights.endDate}): avg ${insights.glucose.breakdowns.fasting.average} ${insights.glucose.unit} across ${insights.glucose.breakdowns.fasting.count} reading(s).`
        );
      }
      if (insights.bloodPressure.count > 0) {
        summaryLines.push(
          `Blood pressure: avg ${insights.bloodPressure.systolic.average}/${insights.bloodPressure.diastolic.average} mmHg across ${insights.bloodPressure.count} reading(s).`
        );
      }
      if (insights.weight.stats.latest !== null) {
        summaryLines.push(
          `Latest weight: ${insights.weight.stats.latest} ${insights.weight.unit}.`
        );
      }

      return apiSuccess({
        answer: summaryLines.join("\n"),
        sourcePeriod: {
          startDate: insights.startDate,
          endDate: insights.endDate,
        },
        limitations,
      });
    }
  } catch {
    return apiError(
      "AI_SERVICE_ERROR",
      "The assistant is temporarily unavailable. You can inspect all your records directly in Insights.",
      502
    );
  }
}
