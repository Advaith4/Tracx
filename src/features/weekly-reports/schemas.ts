import { z } from "zod";

export const weeklyReportAiNarrativeSchema = z.object({
  summaryParagraph: z.string().min(10).max(800),
  observations: z.array(z.string().min(5).max(300)).min(1).max(6),
  providerQuestions: z.array(z.string().min(5).max(300)).min(1).max(4),
});

export type WeeklyReportAiNarrative = z.infer<
  typeof weeklyReportAiNarrativeSchema
>;

export const generateReportRequestSchema = z.object({
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format.")
    .optional(),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format.")
    .optional(),
  sendEmail: z.boolean().default(false),
});
