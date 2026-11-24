import type { QueryClient } from "@tanstack/react-query";
import type { ExtractedMeasurementItem } from "@/lib/ai/schemas";

export async function saveExtractedMeasurements(params: {
  records: ExtractedMeasurementItem[];
  source: "voice" | "manual" | "import";
}): Promise<number> {
  const { records, source } = params;
  for (const record of records) {
    let url = "";
    let payload: Record<string, unknown> = {};
    let method = "POST";

    if (record.kind === "glucose") {
      url = "/api/measurements/glucose";
      payload = {
        value: record.value,
        unit: record.unit,
        meal_context: record.meal_context,
        timing: record.timing,
        elapsed_minutes: record.elapsed_minutes,
        measured_at: record.measured_at_iso,
        notes: record.notes,
        source,
        allowDuplicate: true,
      };
    } else if (record.kind === "blood_pressure") {
      url = "/api/measurements/blood-pressure";
      payload = {
        systolic: record.systolic,
        diastolic: record.diastolic,
        pulse: record.pulse,
        measured_at: record.measured_at_iso,
        notes: record.notes,
        source,
        allowDuplicate: true,
      };
    } else if (record.kind === "weight") {
      url = "/api/measurements/weight";
      payload = {
        value: record.value,
        unit: record.unit,
        measured_at: record.measured_at_iso,
        notes: record.notes,
        source,
        allowDuplicate: true,
      };
    } else {
      url = "/api/daily-notes";
      method = "PUT";
      payload = {
        note_date: record.note_date,
        content: record.content,
      };
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? "Failed to save record.");
    }
  }
  return records.length;
}

export function invalidateAllHealthQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["measurements"] });
  void queryClient.invalidateQueries({ queryKey: ["logbook"] });
  void queryClient.invalidateQueries({ queryKey: ["calendar"] });
  void queryClient.invalidateQueries({ queryKey: ["insights"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
}
