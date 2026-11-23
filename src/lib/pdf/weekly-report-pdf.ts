import { jsPDF } from "jspdf";
import type { WeeklyReportAiNarrative } from "@/features/weekly-reports/schemas";
import type { WeeklyReportStatistics } from "@/lib/calculations/weekly-report";

export function buildWeeklyReportPdf(params: {
  userName?: string | null;
  generatedAt: string;
  stats: WeeklyReportStatistics;
  narrative: WeeklyReportAiNarrative;
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  function ensureSpace(needed = 28) {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 52;
    }
  }

  function writeHeading(text: string) {
    ensureSpace(34);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(32, 78, 72);
    doc.text(text, margin, y);
    y += 16;
  }

  function writeBody(text: string, indent = 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 45, 52);
    const lines = doc.splitTextToSize(text, maxWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, margin + indent, y);
      y += 14;
    }
  }

  // Title header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(25, 62, 58);
  doc.text("Tracx Weekly Health Report", margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(95, 105, 115);
  const metaParts = [
    params.userName ? `Name: ${params.userName}` : null,
    `Period: ${params.stats.periodStart} to ${params.stats.periodEnd}`,
    `Generated: ${new Date(params.generatedAt).toLocaleString()}`,
  ].filter(Boolean);
  doc.text(metaParts.join("  |  "), margin, y);
  y += 18;

  doc.setDrawColor(215, 222, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  // Overview
  writeHeading("1. Report Overview & Consistency");
  writeBody(params.narrative.summaryParagraph);
  y += 4;
  writeBody(
    `Scheduled: ${params.stats.overview.totalScheduled}  |  Recorded: ${params.stats.overview.totalRecorded}  |  Skipped: ${params.stats.overview.totalSkipped}  |  Missing: ${params.stats.overview.missingCount}${
      params.stats.overview.completionPercent !== null
        ? `  |  Completion: ${params.stats.overview.completionPercent}%`
        : ""
    }`
  );

  // Blood Glucose (context-separated)
  writeHeading(`2. Blood Glucose Summary (${params.stats.glucose.unit})`);
  if (params.stats.glucose.totalCount === 0) {
    writeBody("No blood glucose measurements recorded during this period.");
  } else {
    for (const ctx of params.stats.glucose.contexts) {
      if (ctx.stats.count === 0) continue;
      writeBody(
        `- ${ctx.label}: ${ctx.stats.count} reading(s), avg ${ctx.stats.average} ${params.stats.glucose.unit} (range ${ctx.stats.min}–${ctx.stats.max})`
      );
    }
  }

  // Blood Pressure
  writeHeading("3. Blood Pressure Summary (mmHg)");
  if (params.stats.bloodPressure.count === 0) {
    writeBody("No blood pressure measurements recorded during this period.");
  } else {
    writeBody(
      `Readings: ${params.stats.bloodPressure.count}  |  Avg Systolic: ${params.stats.bloodPressure.systolic.average}  |  Avg Diastolic: ${params.stats.bloodPressure.diastolic.average}${
        params.stats.bloodPressure.pulse.average !== null
          ? `  |  Avg Pulse: ${params.stats.bloodPressure.pulse.average} bpm`
          : ""
      }`
    );
    for (const r of params.stats.bloodPressure.readings.slice(0, 14)) {
      writeBody(`- ${r.measuredAtLabel}: ${r.value}`, 8);
    }
  }

  // Weight
  writeHeading(`4. Weight Summary (${params.stats.weight.unit})`);
  if (params.stats.weight.stats.count === 0) {
    writeBody("No weight records logged during this period.");
  } else {
    const changeLabel =
      params.stats.weight.stats.change !== null
        ? `${params.stats.weight.stats.change > 0 ? "+" : ""}${params.stats.weight.stats.change} ${params.stats.weight.unit}`
        : "N/A";
    writeBody(
      `Records: ${params.stats.weight.stats.count}  |  Latest: ${params.stats.weight.stats.latest} ${params.stats.weight.unit}  |  Period change: ${changeLabel}`
    );
  }

  // Observations
  writeHeading("5. Descriptive Observations");
  for (const obs of params.narrative.observations) {
    writeBody(`- ${obs}`);
  }

  // Questions for provider
  writeHeading("6. Questions to Discuss With Your Healthcare Provider");
  for (const q of params.narrative.providerQuestions) {
    writeBody(`- ${q}`);
  }

  // Daily Notes
  if (params.stats.notes.length > 0) {
    writeHeading("7. Notes Recorded This Period");
    for (const n of params.stats.notes) {
      writeBody(`- ${n.noteDate}: ${n.content}`);
    }
  }

  // Data Limitations & Disclaimer
  writeHeading("Data Limitations & Notice");
  for (const lim of params.stats.dataLimitations) {
    writeBody(`- ${lim}`);
  }

  return doc.output("arraybuffer")
    ? new Uint8Array(doc.output("arraybuffer"))
    : new Uint8Array();
}
