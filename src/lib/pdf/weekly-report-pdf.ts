import { jsPDF } from "jspdf";
import type { WeeklyReportAiNarrative } from "@/features/weekly-reports/schemas";
import type { WeeklyReportStatistics } from "@/lib/calculations/weekly-report";

interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

interface PdfChartSeries {
  name: string;
  values: number[];
  color: [number, number, number];
}

export function buildWeeklyReportPdf(params: {
  userName?: string | null;
  generatedAt: string;
  stats: WeeklyReportStatistics;
  narrative: WeeklyReportAiNarrative;
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const maxWidth = pageWidth - margin * 2;
  let y = 48;

  function ensureSpace(needed = 32) {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  }

  function writeHeading(text: string) {
    ensureSpace(36);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(32, 86, 80);
    doc.text(text, margin, y);
    y += 14;
  }

  function writeBody(text: string, indent = 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(45, 52, 58);
    const lines = doc.splitTextToSize(text, maxWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, margin + indent, y);
      y += 13.5;
    }
  }

  function drawTable(columns: TableColumn[], rows: string[][]) {
    if (rows.length === 0) return;
    const rowHeight = 20;

    function renderHeader() {
      ensureSpace(rowHeight * 2);
      doc.setFillColor(235, 244, 242);
      doc.rect(margin, y, maxWidth, rowHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(32, 86, 80);

      let colX = margin;
      for (const col of columns) {
        const textX = col.align === "right" ? colX + col.width - 8 : colX + 8;
        doc.text(col.header, textX, y + 13, {
          align: col.align === "right" ? "right" : "left",
        });
        colX += col.width;
      }
      y += rowHeight;
    }

    renderHeader();

    rows.forEach((cells, rowIdx) => {
      const wrappedLinesPerCell = cells.map((cell, idx) =>
        doc.splitTextToSize(cell, columns[idx].width - 16) as string[]
      );
      const maxLines = Math.max(...wrappedLinesPerCell.map((l) => l.length), 1);
      const cellHeight = Math.max(rowHeight, maxLines * 12 + 8);

      if (y + cellHeight > pageHeight - 48) {
        doc.addPage();
        y = 48;
        renderHeader();
      }

      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 249);
        doc.rect(margin, y, maxWidth, cellHeight, "F");
      }

      doc.setDrawColor(230, 234, 233);
      doc.line(margin, y + cellHeight, margin + maxWidth, y + cellHeight);

      doc.setFont("helvetica", rowIdx >= 0 ? "normal" : "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(40, 46, 52);

      let colX = margin;
      cells.forEach((_, colIdx) => {
        const col = columns[colIdx];
        const lines = wrappedLinesPerCell[colIdx];
        const textX = col.align === "right" ? colX + col.width - 8 : colX + 8;
        lines.forEach((line, lineIdx) => {
          doc.text(line, textX, y + 13 + lineIdx * 11, {
            align: col.align === "right" ? "right" : "left",
          });
        });
        colX += col.width;
      });

      y += cellHeight;
    });

    y += 10;
  }

  function drawLineChart(
    title: string,
    unitLabel: string,
    xLabels: string[],
    seriesList: PdfChartSeries[]
  ) {
    const validSeries = seriesList.filter((s) => s.values.length >= 2);
    if (validSeries.length === 0) return;

    const chartHeight = 118;
    ensureSpace(chartHeight + 36);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(32, 86, 80);
    doc.text(`${title} (${unitLabel})`, margin, y + 10);

    // Legend top-right
    let legendX = pageWidth - margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (let i = validSeries.length - 1; i >= 0; i--) {
      const s = validSeries[i];
      const textWidth = doc.getTextWidth(s.name);
      legendX -= textWidth;
      doc.setTextColor(65, 72, 78);
      doc.text(s.name, legendX, y + 10);
      legendX -= 12;
      doc.setFillColor(...s.color);
      doc.circle(legendX + 4, y + 7, 3, "F");
      legendX -= 10;
    }

    const boxTop = y + 18;
    const plotLeft = margin + 36;
    const plotWidth = maxWidth - 46;
    const plotTop = boxTop + 10;
    const plotHeight = 76;
    const plotBottom = plotTop + plotHeight;

    doc.setFillColor(250, 251, 250);
    doc.setDrawColor(225, 230, 229);
    doc.roundedRect(margin, boxTop, maxWidth, chartHeight - 16, 4, 4, "FD");

    const allValues = validSeries.flatMap((s) => s.values);
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const pad = Math.max((rawMax - rawMin) * 0.15, 2);
    const minVal = Math.floor(rawMin - pad);
    const maxVal = Math.ceil(rawMax + pad);
    const span = Math.max(maxVal - minVal, 1);

    // Gridlines + Y-axis labels
    doc.setDrawColor(232, 236, 235);
    doc.setFontSize(7.5);
    doc.setTextColor(110, 118, 125);
    for (let step = 0; step <= 2; step++) {
      const ratio = step / 2;
      const py = plotBottom - ratio * plotHeight;
      const valLabel = Math.round(minVal + ratio * span);
      doc.line(plotLeft, py, plotLeft + plotWidth, py);
      doc.text(String(valLabel), plotLeft - 6, py + 2.5, { align: "right" });
    }

    // X start & end labels
    if (xLabels.length > 0) {
      doc.text(xLabels[0], plotLeft, plotBottom + 12);
      if (xLabels.length > 1) {
        doc.text(xLabels[xLabels.length - 1], plotLeft + plotWidth, plotBottom + 12, {
          align: "right",
        });
      }
    }

    // Plot each series
    for (const series of validSeries) {
      doc.setDrawColor(...series.color);
      doc.setFillColor(...series.color);
      doc.setLineWidth(1.4);

      const coords = series.values.map((v, idx) => {
        const px =
          series.values.length === 1
            ? plotLeft + plotWidth / 2
            : plotLeft + (idx / (series.values.length - 1)) * plotWidth;
        const py = plotBottom - ((v - minVal) / span) * plotHeight;
        return [px, py] as const;
      });

      for (let i = 1; i < coords.length; i++) {
        doc.line(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      }
      for (const [px, py] of coords) {
        doc.circle(px, py, 2.2, "F");
      }
    }

    doc.setLineWidth(0.5);
    y += chartHeight + 12;
  }

  // Title header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(25, 62, 58);
  doc.text("Tracx Weekly Health Report", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(95, 105, 115);
  const metaParts = [
    params.userName ? `Name: ${params.userName}` : null,
    `Period: ${params.stats.periodStart} to ${params.stats.periodEnd}`,
    `Generated: ${new Date(params.generatedAt).toISOString().slice(0, 10)}`,
  ].filter(Boolean);
  doc.text(metaParts.join("  |  "), margin, y);
  y += 14;

  // Overview KPI Cards
  writeHeading("1. Overview & Adherence");
  writeBody(params.narrative.summaryParagraph);
  y += 4;

  const kpiGap = 8;
  const kpiWidth = (maxWidth - kpiGap * 3) / 4;
  const kpiItems = [
    [
      "ADHERENCE",
      params.stats.overview.completionPercent !== null
        ? `${params.stats.overview.completionPercent}%`
        : "--",
    ],
    ["RECORDED", String(params.stats.overview.totalRecorded)],
    ["SKIPPED", String(params.stats.overview.totalSkipped)],
    ["MISSING", String(params.stats.overview.missingCount)],
  ];
  ensureSpace(48);
  kpiItems.forEach(([kLabel, kVal], idx) => {
    const bx = margin + idx * (kpiWidth + kpiGap);
    doc.setFillColor(244, 247, 246);
    doc.roundedRect(bx, y, kpiWidth, 40, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(95, 105, 115);
    doc.text(kLabel, bx + 10, y + 14);
    doc.setFontSize(13);
    doc.setTextColor(25, 62, 58);
    doc.text(kVal, bx + 10, y + 31);
  });
  y += 52;

  // Table 1: Blood Glucose
  writeHeading(`2. Blood Glucose Table (${params.stats.glucose.unit})`);
  const glucoseRows = params.stats.glucose.contexts
    .filter((c) => c.stats.count > 0)
    .map((c) => [
      c.label,
      String(c.stats.count),
      `${c.stats.average} ${params.stats.glucose.unit}`,
      `${c.stats.min}–${c.stats.max} ${params.stats.glucose.unit}`,
      `${c.stats.latest} ${params.stats.glucose.unit}`,
    ]);
  if (glucoseRows.length === 0) {
    writeBody("No blood glucose measurements recorded during this period.");
  } else {
    drawTable(
      [
        { header: "Meal Context", width: 155 },
        { header: "Readings", width: 70, align: "right" },
        { header: "Average", width: 95, align: "right" },
        { header: "Range", width: 105, align: "right" },
        { header: "Latest", width: maxWidth - 425, align: "right" },
      ],
      glucoseRows
    );
  }

  // Table 2: Vitals & Custom Metrics
  writeHeading("3. Vitals & Custom Metrics Table");
  const vitalsRows: string[][] = [
    [
      "Blood Pressure",
      String(params.stats.bloodPressure.count),
      params.stats.bloodPressure.count > 0
        ? `${params.stats.bloodPressure.systolic.average}/${params.stats.bloodPressure.diastolic.average} mmHg`
        : "--",
      params.stats.bloodPressure.count > 0
        ? `${params.stats.bloodPressure.systolic.min}–${params.stats.bloodPressure.systolic.max}`
        : "--",
      params.stats.bloodPressure.systolic.latest !== null
        ? `${params.stats.bloodPressure.systolic.latest}/${params.stats.bloodPressure.diastolic.latest} mmHg`
        : "--",
    ],
    [
      "Weight",
      String(params.stats.weight.stats.count),
      params.stats.weight.stats.average !== null
        ? `${params.stats.weight.stats.average} ${params.stats.weight.unit}`
        : "--",
      params.stats.weight.stats.change !== null
        ? `${params.stats.weight.stats.change > 0 ? "+" : ""}${params.stats.weight.stats.change} ${params.stats.weight.unit}`
        : "--",
      params.stats.weight.stats.latest !== null
        ? `${params.stats.weight.stats.latest} ${params.stats.weight.unit}`
        : "--",
    ],
  ];

  for (const custom of params.stats.customMetrics ?? []) {
    vitalsRows.push([
      custom.label,
      String(custom.totalCount),
      custom.stats.average !== null ? `${custom.stats.average} ${custom.unit}` : "--",
      custom.stats.min !== null && custom.stats.max !== null
        ? `${custom.stats.min}–${custom.stats.max} ${custom.unit}`
        : "--",
      custom.stats.latest !== null ? `${custom.stats.latest} ${custom.unit}` : "--",
    ]);
  }

  drawTable(
    [
      { header: "Metric", width: 155 },
      { header: "Readings", width: 70, align: "right" },
      { header: "Average", width: 95, align: "right" },
      { header: "Range / Change", width: 105, align: "right" },
      { header: "Latest", width: maxWidth - 425, align: "right" },
    ],
    vitalsRows
  );

  // Visualizations (up to 3 trend charts)
  const glucosePts = params.stats.glucose.points ?? [];
  const bpPts = params.stats.bloodPressure.points ?? [];
  const weightPts = params.stats.weight.points ?? [];

  if (glucosePts.length >= 2 || bpPts.length >= 2 || weightPts.length >= 2) {
    writeHeading("4. Trend Visualizations");

    if (glucosePts.length >= 2) {
      const fastingVals = glucosePts
        .filter((p) => p.contextGroup === "fasting")
        .map((p) => p.value);
      const afterVals = glucosePts
        .filter((p) => p.contextGroup === "after")
        .map((p) => p.value);
      drawLineChart(
        "Blood Glucose Trend",
        params.stats.glucose.unit,
        glucosePts.map((p) => p.dateLabel),
        [
          { name: "Fasting", values: fastingVals, color: [43, 122, 120] },
          { name: "After meal", values: afterVals, color: [217, 119, 6] },
        ]
      );
    }

    if (bpPts.length >= 2) {
      drawLineChart(
        "Blood Pressure Trend",
        "mmHg",
        bpPts.map((p) => p.dateLabel),
        [
          {
            name: "Systolic",
            values: bpPts.map((p) => p.systolic),
            color: [43, 122, 120],
          },
          {
            name: "Diastolic",
            values: bpPts.map((p) => p.diastolic),
            color: [59, 130, 246],
          },
        ]
      );
    }

    if (weightPts.length >= 2) {
      drawLineChart(
        "Weight Trend",
        params.stats.weight.unit,
        weightPts.map((p) => p.dateLabel),
        [
          {
            name: `Weight (${params.stats.weight.unit})`,
            values: weightPts.map((p) => p.value),
            color: [43, 122, 120],
          },
        ]
      );
    }
  }

  // Observations & Provider Questions
  writeHeading("5. Descriptive Observations");
  for (const obs of params.narrative.observations) {
    writeBody(`- ${obs}`);
  }

  writeHeading("6. Questions to Discuss With Your Healthcare Provider");
  for (const q of params.narrative.providerQuestions) {
    writeBody(`- ${q}`);
  }

  // Daily Notes Table
  if (params.stats.notes.length > 0) {
    writeHeading("7. Daily Notes");
    drawTable(
      [
        { header: "Date", width: 95 },
        { header: "Note", width: maxWidth - 95 },
      ],
      params.stats.notes.map((n) => [n.noteDate, n.content])
    );
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
