import { generateText, Output } from "ai";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import {
  weeklyReportAiNarrativeSchema,
  type WeeklyReportAiNarrative,
} from "@/features/weekly-reports/schemas";
import { buildWeeklyReportSystemPrompt } from "@/lib/ai/prompts/weekly-report";
import {
  resolveAiModelCandidates,
  runWithAiFallback,
} from "@/lib/ai/providers";
import { safeTimezone } from "@/lib/calculations/daily-status";
import {
  buildDeterministicFallbackNarrative,
  computeWeeklyReportStatistics,
  getDefaultWeeklyPeriod,
  type WeeklyReportStatistics,
} from "@/lib/calculations/weekly-report";
import type { Database, Json, Tables } from "@/types/database";

export interface ParsedWeeklyReport {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  status: string;
  summary: string;
  statistics: WeeklyReportStatistics;
  narrative: WeeklyReportAiNarrative;
}

export function hydrateWeeklyReport(
  row: Tables<"weekly_reports">
): ParsedWeeklyReport {
  const stats = row.statistics as unknown as WeeklyReportStatistics;
  const reportData = (row.report_data ?? {}) as {
    narrative?: WeeklyReportAiNarrative;
  };
  const fallback = buildDeterministicFallbackNarrative(stats);

  return {
    id: row.id,
    userId: row.user_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    generatedAt: row.generated_at ?? row.created_at,
    status: row.status,
    summary: row.summary ?? fallback.summaryParagraph,
    statistics: stats,
    narrative: reportData.narrative ?? fallback,
  };
}

export async function generateWeeklyReportEmail(params: {
  to: string;
  report: ParsedWeeklyReport;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY is not configured." };
  }

  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() || "Tracx <onboarding@resend.dev>";

  const { report } = params;
  const lines = [
    `Tracx Weekly Health Report (${report.periodStart} to ${report.periodEnd})`,
    "",
    report.narrative.summaryParagraph,
    "",
    `Overview: ${report.statistics.overview.totalRecorded} recorded, ${report.statistics.overview.totalSkipped} skipped, ${report.statistics.overview.missingCount} missing.`,
    "",
    "Observations:",
    ...report.narrative.observations.map((o) => `- ${o}`),
    "",
    "Questions to discuss with your healthcare provider:",
    ...report.narrative.providerQuestions.map((q) => `- ${q}`),
    "",
    "Note: This report is a personal tracking summary and not a medical diagnosis.",
  ];

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: `Your Tracx Weekly Health Report (${report.periodStart} – ${report.periodEnd})`,
      text: lines.join("\n"),
    });
    if (error) {
      return { sent: false, error: "Email provider returned an error." };
    }
    return { sent: true };
  } catch {
    return { sent: false, error: "Couldn't send report email." };
  }
}

export async function generateAndSaveWeeklyReport(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  userEmail?: string | null;
  periodStart?: string;
  periodEnd?: string;
  sendEmail?: boolean;
}) {
  const [{ data: profile }, configs] = await Promise.all([
    params.supabase
      .from("profiles")
      .select("timezone")
      .eq("id", params.userId)
      .maybeSingle(),
    ensureAndListTrackingConfigs(params.supabase, params.userId),
  ]);

  const timezone = safeTimezone(profile?.timezone);
  const defaults = getDefaultWeeklyPeriod(timezone);
  const rawStart = params.periodStart ?? defaults.periodStart;
  const rawEnd = params.periodEnd ?? defaults.periodEnd;
  const periodStart = rawStart <= rawEnd ? rawStart : rawEnd;
  const periodEnd = rawStart <= rawEnd ? rawEnd : rawStart;

  const startIso = new Date(
    new Date(`${periodStart}T00:00:00.000Z`).getTime() - 14 * 60 * 60 * 1000
  ).toISOString();
  const endIso = new Date(
    new Date(`${periodEnd}T23:59:59.999Z`).getTime() + 14 * 60 * 60 * 1000
  ).toISOString();

  const [glucoseRes, bpRes, weightRes, customRes, skipsRes, notesRes] =
    await Promise.all([
      params.supabase
        .from("glucose_records")
        .select("*")
        .eq("user_id", params.userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso),
      params.supabase
        .from("blood_pressure_records")
        .select("*")
        .eq("user_id", params.userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso),
      params.supabase
        .from("weight_records")
        .select("*")
        .eq("user_id", params.userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso),
      params.supabase
        .from("custom_metric_records")
        .select("*")
        .eq("user_id", params.userId)
        .gte("measured_at", startIso)
        .lte("measured_at", endIso),
      params.supabase
        .from("measurement_skips")
        .select("*")
        .eq("user_id", params.userId)
        .gte("scheduled_date", periodStart)
        .lte("scheduled_date", periodEnd),
      params.supabase
        .from("daily_notes")
        .select("*")
        .eq("user_id", params.userId)
        .gte("note_date", periodStart)
        .lte("note_date", periodEnd),
    ]);

  const statistics = computeWeeklyReportStatistics({
    periodStart,
    periodEnd,
    timezone,
    configs,
    glucoseRecords: glucoseRes.data ?? [],
    bpRecords: bpRes.data ?? [],
    weightRecords: weightRes.data ?? [],
    customRecords: customRes.data ?? [],
    skips: skipsRes.data ?? [],
    dailyNotes: notesRes.data ?? [],
  });

  let narrative = buildDeterministicFallbackNarrative(statistics);
  let usedAi = false;

  const resolvedModels = resolveAiModelCandidates();
  if (resolvedModels.configured) {
    try {
      const { result: aiResult } = await runWithAiFallback(
        resolvedModels.candidates,
        (model) =>
          generateText({
            model,
            output: Output.object({ schema: weeklyReportAiNarrativeSchema }),
            system: buildWeeklyReportSystemPrompt(),
            prompt: `Generate descriptive weekly observations and provider discussion prompts from this exact deterministic report JSON:\n${JSON.stringify(statistics)}`,
          })
      );
      const validated = weeklyReportAiNarrativeSchema.safeParse(aiResult.output);
      if (validated.success) {
        narrative = validated.data;
        usedAi = true;
      }
    } catch {
      // Deterministic fallback narrative ensures report generation stays reliable.
    }
  }

  const nowIso = new Date().toISOString();
  const { data: saved, error } = await params.supabase
    .from("weekly_reports")
    .insert({
      user_id: params.userId,
      period_start: periodStart,
      period_end: periodEnd,
      statistics: statistics as unknown as Json,
      summary: narrative.summaryParagraph,
      report_data: {
        narrative,
        usedAi,
      } as unknown as Json,
      generated_at: nowIso,
      status: "complete",
    })
    .select("*")
    .single();

  if (error || !saved) {
    throw new Error("Couldn't save weekly report.");
  }

  const hydrated = hydrateWeeklyReport(saved);
  let emailResult: { sent: boolean; error?: string } | null = null;

  if (params.sendEmail && params.userEmail) {
    emailResult = await generateWeeklyReportEmail({
      to: params.userEmail,
      report: hydrated,
    });
  }

  return { report: hydrated, usedAi, emailResult };
}
