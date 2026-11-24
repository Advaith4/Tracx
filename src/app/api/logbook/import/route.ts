import { z } from "zod";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";

const importRequestSchema = z.object({
  glucose: z
    .array(
      z.object({
        value: z.number().positive(),
        unit: z.enum(["mg/dL", "mmol/L"]),
        meal_context: z.enum([
          "fasting",
          "breakfast",
          "lunch",
          "dinner",
          "snack",
          "unknown",
        ]),
        timing: z.enum(["before", "after", "unknown"]),
        elapsed_minutes: z.number().int().nonnegative().nullable().optional(),
        measured_at: z.string().min(1),
        notes: z.string().nullable().optional(),
      })
    )
    .max(500)
    .default([]),
  bloodPressure: z
    .array(
      z.object({
        systolic: z.number().int().min(40).max(300),
        diastolic: z.number().int().min(20).max(200),
        pulse: z.number().int().min(20).max(250).nullable().optional(),
        measured_at: z.string().min(1),
        notes: z.string().nullable().optional(),
      })
    )
    .max(500)
    .default([]),
  weight: z
    .array(
      z.object({
        value: z.number().positive(),
        unit: z.enum(["kg", "lb"]),
        measured_at: z.string().min(1),
        notes: z.string().nullable().optional(),
      })
    )
    .max(500)
    .default([]),
  dailyNotes: z
    .array(
      z.object({
        note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        content: z.string().min(1).max(2000),
      })
    )
    .max(365)
    .default([]),
});

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const body = await request.json().catch(() => null);
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid CSV import payload.",
      400
    );
  }

  const { glucose, bloodPressure, weight, dailyNotes } = parsed.data;
  if (
    glucose.length === 0 &&
    bloodPressure.length === 0 &&
    weight.length === 0 &&
    dailyNotes.length === 0
  ) {
    return apiError(
      "EMPTY_IMPORT",
      "No valid measurements or notes found to import.",
      400
    );
  }

  try {
    const tasks: PromiseLike<unknown>[] = [];

    if (glucose.length > 0) {
      tasks.push(
        supabase.from("glucose_records").insert(
          glucose.map((g) => ({
            user_id: user.id,
            value: g.value,
            unit: g.unit,
            meal_context: g.meal_context,
            timing: g.timing,
            elapsed_minutes: g.elapsed_minutes ?? null,
            measured_at: new Date(g.measured_at).toISOString(),
            notes: g.notes ?? null,
            source: "import" as const,
          }))
        )
      );
    }

    if (bloodPressure.length > 0) {
      tasks.push(
        supabase.from("blood_pressure_records").insert(
          bloodPressure.map((bp) => ({
            user_id: user.id,
            systolic: bp.systolic,
            diastolic: bp.diastolic,
            pulse: bp.pulse ?? null,
            measured_at: new Date(bp.measured_at).toISOString(),
            notes: bp.notes ?? null,
            source: "import" as const,
          }))
        )
      );
    }

    if (weight.length > 0) {
      tasks.push(
        supabase.from("weight_records").insert(
          weight.map((w) => ({
            user_id: user.id,
            value: w.value,
            unit: w.unit,
            measured_at: new Date(w.measured_at).toISOString(),
            notes: w.notes ?? null,
            source: "import" as const,
          }))
        )
      );
    }

    if (dailyNotes.length > 0) {
      tasks.push(
        supabase.from("daily_notes").upsert(
          dailyNotes.map((n) => ({
            user_id: user.id,
            note_date: n.note_date,
            content: n.content,
          })),
          { onConflict: "user_id,note_date" }
        )
      );
    }

    await Promise.all(tasks);

    return apiSuccess(
      {
        importedCount:
          glucose.length + bloodPressure.length + weight.length + dailyNotes.length,
      },
      201
    );
  } catch {
    return apiError(
      "IMPORT_FAILED",
      "Couldn't import CSV records. Please check your file format.",
      500
    );
  }
}
