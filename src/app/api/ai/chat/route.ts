import { streamText } from "ai";
import { getInsightsData } from "@/features/insights/service";
import { getTodayScheduledTasks } from "@/features/tracking-config/schedule-utils";
import { buildDataAssistantSystemPrompt } from "@/lib/ai/prompts/data-assistant";
import { resolveAiModelCandidates } from "@/lib/ai/providers";
import {
  checkAiRateLimit,
  detectUrgentSymptomMention,
  URGENT_CARE_GUIDANCE,
} from "@/lib/ai/safety";
import { chatRequestSchema } from "@/lib/ai/schemas";
import type { DateRangePreset } from "@/lib/calculations/analytics";
import {
  getLocalDateString,
  resolveTodayTasksWithRecords,
} from "@/lib/calculations/daily-status";
import { apiError, requireApiUser } from "@/lib/supabase/api-helpers";

const GREETING_REGEX =
  /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening)|thanks?|thank\s*you|ok+|okay)[\s!?.]*$/i;

function inferPresetFromMessage(
  message: string,
  fallback: DateRangePreset
): DateRangePreset {
  const lower = message.toLowerCase();
  if (lower.includes("30 day") || lower.includes("month")) return "30d";
  if (lower.includes("7 day") || lower.includes("week")) return "7d";
  return fallback;
}

function createImmediateTextResponse(text: string, limitations: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Tracx-Limitations": encodeURIComponent(limitations),
    },
  });
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

  const messageText = parsed.data.message.trim();

  if (detectUrgentSymptomMention(messageText)) {
    return createImmediateTextResponse(
      URGENT_CARE_GUIDANCE,
      "Emergency or symptom evaluation is outside the scope of Tracx."
    );
  }

  if (GREETING_REGEX.test(messageText)) {
    const isThanks = /thank/i.test(messageText);
    const reply = isThanks
      ? "You're welcome! Ask me anytime about your glucose, blood pressure, weight, custom metrics, or today's remaining check-ins."
      : "Hi! I'm your Tracx health data assistant. Ask me about your recent readings, fasting or post-meal trends, or what's still scheduled for today.";
    return createImmediateTextResponse(
      reply,
      "Tracx summarizes your recorded health data only and does not provide medical advice."
    );
  }

  const resolvedModels = resolveAiModelCandidates();
  if (!resolvedModels.configured) {
    return apiError("AI_NOT_CONFIGURED", resolvedModels.reason, 503);
  }

  try {
    const preset = inferPresetFromMessage(messageText, parsed.data.rangePreset);
    const insights = await getInsightsData(supabase, user.id, {
      preset,
      glucoseContext: "all",
    });

    // Compute today's task state directly from already-loaded insights data (saves 7 DB round-trips)
    const now = new Date();
    const todayDate = getLocalDateString(now, insights.timezone);
    const { data: todaySkips } = await supabase
      .from("measurement_skips")
      .select("*")
      .eq("user_id", user.id)
      .eq("scheduled_date", todayDate);

    const todayGlucose = insights.history
      .filter((h) => h.rawGlucose)
      .map((h) => h.rawGlucose!);
    const todayBp = insights.history
      .filter((h) => h.rawBloodPressure)
      .map((h) => h.rawBloodPressure!);
    const todayWeight = insights.history
      .filter((h) => h.rawWeight)
      .map((h) => h.rawWeight!);
    const todayCustom = insights.history
      .filter((h) => h.rawCustom)
      .map((h) => h.rawCustom!);

    const scheduledTasks = getTodayScheduledTasks(
      insights.configs,
      insights.timezone,
      now
    );
    const todayTasks = resolveTodayTasksWithRecords({
      tasks: scheduledTasks,
      timezone: insights.timezone,
      todayDate,
      glucoseRecords: todayGlucose,
      bpRecords: todayBp,
      weightRecords: todayWeight,
      customRecords: todayCustom,
      skips: todaySkips ?? [],
    });

    const factualContext = {
      todayDate,
      timezone: insights.timezone,
      todayTasks: todayTasks.map((t) => ({
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
        customMetrics: insights.customMetrics.map((c) => ({
          label: c.label,
          unit: c.unit,
          stats: c.stats,
        })),
        completion: insights.completion,
      },
      records: insights.history.slice(0, 30).map((r) => ({
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

    const recentTurns = (parsed.data.history ?? [])
      .slice(-6)
      .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}`)
      .join("\n");

    const promptText = `${
      recentTurns ? `Recent conversation:\n${recentTurns}\n\n` : ""
    }User question: ${messageText}

Retrieved factual records & deterministic statistics (JSON):
${JSON.stringify(factualContext)}`;

    const encoder = new TextEncoder();
    const candidates = resolvedModels.candidates;

    const stream = new ReadableStream({
      async start(controller) {
        let streamedAny = false;
        let lastError: unknown = null;

        for (const candidate of candidates) {
          try {
            const result = streamText({
              model: candidate.model,
              system: buildDataAssistantSystemPrompt(),
              prompt: promptText,
            });

            for await (const delta of result.textStream) {
              if (delta) {
                streamedAny = true;
                controller.enqueue(encoder.encode(delta));
              }
            }

            if (streamedAny) {
              controller.close();
              return;
            }
          } catch (err) {
            lastError = err;
            if (streamedAny) {
              controller.close();
              return;
            }
          }
        }

        console.error(
          "AI chat stream error:",
          lastError instanceof Error ? lastError.message : lastError
        );

        const remainingToday = todayTasks.filter(
          (t) => t.status === "pending" || t.status === "upcoming"
        );
        const summaryLines = [
          "Here is a direct summary from your saved records:",
          "",
          remainingToday.length > 0
            ? `• Remaining today (${todayDate}): ${remainingToday
                .map(
                  (t) =>
                    `${t.measurementName} (${t.context} at ${t.scheduledTime})`
                )
                .join(", ")}.`
            : `• All scheduled check-ins for ${todayDate} are accounted for.`,
        ];

        if (insights.glucose.breakdowns.fasting.count > 0) {
          summaryLines.push(
            `• Fasting glucose (${insights.startDate} to ${insights.endDate}): avg ${insights.glucose.breakdowns.fasting.average} ${insights.glucose.unit} across ${insights.glucose.breakdowns.fasting.count} reading(s).`
          );
        }
        if (insights.bloodPressure.count > 0) {
          summaryLines.push(
            `• Blood pressure: avg ${insights.bloodPressure.systolic.average}/${insights.bloodPressure.diastolic.average} mmHg across ${insights.bloodPressure.count} reading(s).`
          );
        }
        if (insights.weight.stats.latest !== null) {
          summaryLines.push(
            `• Latest weight: ${insights.weight.stats.latest} ${insights.weight.unit}.`
          );
        }

        controller.enqueue(encoder.encode(summaryLines.join("\n")));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Tracx-Limitations": encodeURIComponent(limitations),
      },
    });
  } catch (err) {
    console.error("AI chat context error:", err instanceof Error ? err.message : err);
    return apiError(
      "AI_SERVICE_ERROR",
      "The assistant is temporarily unavailable. You can inspect all your records directly in Insights.",
      502
    );
  }
}
