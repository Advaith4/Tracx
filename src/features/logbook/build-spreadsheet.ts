import type { UnifiedMeasurement } from "@/features/measurements/service";
import { parseProviderTargets } from "@/features/tracking-config/schedule-utils";
import {
  computeNumericStats,
  convertGlucoseValue,
  convertWeightValue,
  roundToOneDecimal,
} from "@/lib/calculations/analytics";
import {
  formatLocalDateTimeLabel,
  getLocalDateString,
  getLocalHHMM,
  safeTimezone,
} from "@/lib/calculations/daily-status";
import type {
  GlucoseUnit,
  MealContext,
  MealTiming,
  Tables,
  WeightUnit,
} from "@/types/database";

export type GlucoseSlotKey =
  | "fasting"
  | "beforeBreakfast"
  | "afterBreakfast"
  | "beforeLunch"
  | "afterLunch"
  | "beforeDinner"
  | "afterDinner"
  | "other";

export const GLUCOSE_SHEET_COLUMNS: Array<{
  key: GlucoseSlotKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "fasting", label: "Fasting", shortLabel: "Fasting" },
  {
    key: "beforeBreakfast",
    label: "Before Breakfast",
    shortLabel: "Pre-Bkfst",
  },
  {
    key: "afterBreakfast",
    label: "After Breakfast",
    shortLabel: "Post-Bkfst",
  },
  { key: "beforeLunch", label: "Before Lunch", shortLabel: "Pre-Lunch" },
  { key: "afterLunch", label: "After Lunch", shortLabel: "Post-Lunch" },
  { key: "beforeDinner", label: "Before Dinner", shortLabel: "Pre-Dinner" },
  { key: "afterDinner", label: "After Dinner", shortLabel: "Post-Dinner" },
  { key: "other", label: "Snack / Other", shortLabel: "Other" },
];

export interface SpreadsheetCellEntry {
  id: string;
  metricType: UnifiedMeasurement["metricType"];
  displayText: string;
  numericValue: number | null;
  timeLabel: string;
  notes: string | null;
  aboveReference: boolean;
  source: UnifiedMeasurement["source"];
  measurement: UnifiedMeasurement;
}

export interface DailySheetRow {
  date: string;
  dateLabel: string;
  weekday: string;
  glucoseCells: Record<GlucoseSlotKey, SpreadsheetCellEntry[]>;
  glucoseDayAvg: number | null;
  bloodPressure: SpreadsheetCellEntry[];
  weight: SpreadsheetCellEntry[];
  customCells: Record<string, SpreadsheetCellEntry[]>;
  dailyNote: string;
  totalCount: number;
}

export interface CustomColumnMeta {
  configId: string;
  label: string;
  unit: string;
}

export interface SheetColumnSummary {
  totalDaysWithLogs: number;
  totalReadings: number;
  glucoseSlotAverages: Record<GlucoseSlotKey, number | null>;
  overallGlucoseAverage: number | null;
  avgSystolic: number | null;
  avgDiastolic: number | null;
  latestWeight: number | null;
  weightChange: number | null;
}

export interface SpreadsheetData {
  rows: DailySheetRow[];
  customColumns: CustomColumnMeta[];
  summary: SheetColumnSummary;
  glucoseUnit: GlucoseUnit;
  weightUnit: WeightUnit;
}

function classifyGlucoseSlot(
  mealContext: MealContext,
  timing: MealTiming
): GlucoseSlotKey {
  if (mealContext === "fasting") return "fasting";
  if (mealContext === "breakfast") {
    return timing === "before" ? "beforeBreakfast" : "afterBreakfast";
  }
  if (mealContext === "lunch") {
    return timing === "before" ? "beforeLunch" : "afterLunch";
  }
  if (mealContext === "dinner") {
    return timing === "before" ? "beforeDinner" : "afterDinner";
  }
  return "other";
}

function formatShortDate(dateStr: string): {
  dateLabel: string;
  weekday: string;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return { dateLabel: dateStr, weekday: "" };
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    dateLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(dt),
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "UTC",
    }).format(dt),
  };
}

function formatHHMM12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const disp = h % 12 === 0 ? 12 : h % 12;
  return `${disp}:${String(m).padStart(2, "0")} ${period}`;
}

function enumerateDateStringsDesc(
  startDate: string,
  endDate: string,
  maxDays = 180
): string[] {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [];

  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const dates: string[] = [];
  for (
    let ms = endMs;
    ms >= startMs && dates.length < maxDays;
    ms -= 24 * 60 * 60 * 1000
  ) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

export function buildDailySpreadsheet(params: {
  entries: UnifiedMeasurement[];
  dailyNotes: Array<{ note_date: string; content: string }>;
  configs: Tables<"tracking_configs">[];
  startDate: string;
  endDate: string;
  timezone: string;
}): SpreadsheetData {
  const tz = safeTimezone(params.timezone);
  const glucoseConfig = params.configs.find((c) => c.metric_type === "glucose");
  const bpConfig = params.configs.find(
    (c) => c.metric_type === "blood_pressure"
  );
  const weightConfig = params.configs.find((c) => c.metric_type === "weight");

  const glucoseUnit: GlucoseUnit =
    glucoseConfig?.unit === "mmol/L" ? "mmol/L" : "mg/dL";
  const weightUnit: WeightUnit = weightConfig?.unit === "lb" ? "lb" : "kg";

  const glucoseTargets = parseProviderTargets(glucoseConfig?.provider_targets);
  const bpTargets = parseProviderTargets(bpConfig?.provider_targets);

  // Discover all custom metric columns from enabled configs + any custom entries present
  const customColumnMap = new Map<string, CustomColumnMeta>();
  for (const cfg of params.configs) {
    if (cfg.metric_type === "custom" && cfg.enabled) {
      customColumnMap.set(cfg.id, {
        configId: cfg.id,
        label: cfg.custom_label?.trim() || "Custom",
        unit: cfg.unit || "",
      });
    }
  }
  for (const entry of params.entries) {
    if (entry.rawCustom) {
      const cid = entry.rawCustom.metric_config_id;
      if (!customColumnMap.has(cid)) {
        customColumnMap.set(cid, {
          configId: cid,
          label: entry.metricLabel,
          unit: entry.unit || "",
        });
      }
    }
  }
  const customColumns = [...customColumnMap.values()];

  const noteByDate = new Map(
    params.dailyNotes.map((n) => [n.note_date, n.content])
  );

  // Collect all dates that have entries or notes + contiguous dates inside range
  const entryDates = new Set<string>();
  const entriesByDate = new Map<string, UnifiedMeasurement[]>();

  for (const entry of params.entries) {
    const d = getLocalDateString(new Date(entry.measuredAt), tz);
    entryDates.add(d);
    const list = entriesByDate.get(d) ?? [];
    list.push(entry);
    entriesByDate.set(d, list);
  }
  for (const note of params.dailyNotes) {
    if (note.content.trim()) entryDates.add(note.note_date);
  }

  const contiguous = enumerateDateStringsDesc(
    params.startDate,
    params.endDate,
    180
  );
  const dateSet = new Set([...contiguous, ...entryDates]);
  const sortedDates = [...dateSet].sort((a, b) => b.localeCompare(a));

  const slotNumberBuckets: Record<GlucoseSlotKey, number[]> = {
    fasting: [],
    beforeBreakfast: [],
    afterBreakfast: [],
    beforeLunch: [],
    afterLunch: [],
    beforeDinner: [],
    afterDinner: [],
    other: [],
  };
  const allGlucoseNums: number[] = [];
  const allSysNums: number[] = [];
  const allDiaNums: number[] = [];
  const chronologicalWeights: Array<{ measuredAt: string; val: number }> = [];

  const rows: DailySheetRow[] = [];

  for (const dateStr of sortedDates) {
    const dayEntries = (entriesByDate.get(dateStr) ?? [])
      .slice()
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));

    const glucoseCells: Record<GlucoseSlotKey, SpreadsheetCellEntry[]> = {
      fasting: [],
      beforeBreakfast: [],
      afterBreakfast: [],
      beforeLunch: [],
      afterLunch: [],
      beforeDinner: [],
      afterDinner: [],
      other: [],
    };
    const bloodPressure: SpreadsheetCellEntry[] = [];
    const weight: SpreadsheetCellEntry[] = [];
    const customCells: Record<string, SpreadsheetCellEntry[]> = {};
    for (const col of customColumns) {
      customCells[col.configId] = [];
    }

    const dayGlucoseNums: number[] = [];

    for (const item of dayEntries) {
      const timeLabel = formatHHMM12h(
        getLocalHHMM(new Date(item.measuredAt), tz)
      );

      if (item.metricType === "glucose" && item.rawGlucose) {
        const g = item.rawGlucose;
        const val = roundToOneDecimal(
          convertGlucoseValue(
            Number(g.value),
            g.unit as GlucoseUnit,
            glucoseUnit
          )
        );
        const slot = classifyGlucoseSlot(
          g.meal_context as MealContext,
          g.timing as MealTiming
        );

        const ceiling =
          slot === "fasting"
            ? (glucoseTargets?.fastingMax ?? glucoseTargets?.targetMax ?? null)
            : g.timing === "after"
              ? (glucoseTargets?.postMealMax ??
                glucoseTargets?.targetMax ??
                null)
              : (glucoseTargets?.targetMax ?? null);

        const aboveRef =
          ceiling !== null && ceiling !== undefined && val > ceiling;

        glucoseCells[slot].push({
          id: item.id,
          metricType: "glucose",
          displayText: String(val),
          numericValue: val,
          timeLabel,
          notes: item.notes,
          aboveReference: aboveRef,
          source: item.source,
          measurement: item,
        });
        slotNumberBuckets[slot].push(val);
        allGlucoseNums.push(val);
        dayGlucoseNums.push(val);
      } else if (
        item.metricType === "blood_pressure" &&
        item.rawBloodPressure
      ) {
        const bp = item.rawBloodPressure;
        const aboveRef = Boolean(
          (bpTargets?.systolicMax !== null &&
            bpTargets?.systolicMax !== undefined &&
            bp.systolic > bpTargets.systolicMax) ||
            (bpTargets?.diastolicMax !== null &&
              bpTargets?.diastolicMax !== undefined &&
              bp.diastolic > bpTargets.diastolicMax)
        );
        bloodPressure.push({
          id: item.id,
          metricType: "blood_pressure",
          displayText: bp.pulse
            ? `${bp.systolic}/${bp.diastolic} (${bp.pulse})`
            : `${bp.systolic}/${bp.diastolic}`,
          numericValue: bp.systolic,
          timeLabel,
          notes: item.notes,
          aboveReference: aboveRef,
          source: item.source,
          measurement: item,
        });
        allSysNums.push(bp.systolic);
        allDiaNums.push(bp.diastolic);
      } else if (item.metricType === "weight" && item.rawWeight) {
        const w = item.rawWeight;
        const val = roundToOneDecimal(
          convertWeightValue(Number(w.value), w.unit as WeightUnit, weightUnit)
        );
        weight.push({
          id: item.id,
          metricType: "weight",
          displayText: `${val}`,
          numericValue: val,
          timeLabel,
          notes: item.notes,
          aboveReference: false,
          source: item.source,
          measurement: item,
        });
        chronologicalWeights.push({ measuredAt: item.measuredAt, val });
      } else if (item.metricType === "custom" && item.rawCustom) {
        const cid = item.rawCustom.metric_config_id;
        if (!customCells[cid]) customCells[cid] = [];
        const rawVal =
          item.rawCustom.value_numeric !== null
            ? String(item.rawCustom.value_numeric)
            : (item.rawCustom.value_text ?? "");
        customCells[cid].push({
          id: item.id,
          metricType: "custom",
          displayText: rawVal,
          numericValue: item.rawCustom.value_numeric,
          timeLabel,
          notes: item.notes,
          aboveReference: false,
          source: item.source,
          measurement: item,
        });
      }
    }

    const { dateLabel, weekday } = formatShortDate(dateStr);
    const dayAvgStats = computeNumericStats(dayGlucoseNums);

    rows.push({
      date: dateStr,
      dateLabel,
      weekday,
      glucoseCells,
      glucoseDayAvg: dayAvgStats.average,
      bloodPressure,
      weight,
      customCells,
      dailyNote: noteByDate.get(dateStr) ?? "",
      totalCount: dayEntries.length,
    });
  }

  chronologicalWeights.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const weightStats = computeNumericStats(
    chronologicalWeights.map((w) => w.val)
  );

  const glucoseSlotAverages = {} as Record<GlucoseSlotKey, number | null>;
  for (const col of GLUCOSE_SHEET_COLUMNS) {
    glucoseSlotAverages[col.key] = computeNumericStats(
      slotNumberBuckets[col.key]
    ).average;
  }

  return {
    rows,
    customColumns,
    summary: {
      totalDaysWithLogs: rows.filter((r) => r.totalCount > 0).length,
      totalReadings: params.entries.length,
      glucoseSlotAverages,
      overallGlucoseAverage: computeNumericStats(allGlucoseNums).average,
      avgSystolic: computeNumericStats(allSysNums).average,
      avgDiastolic: computeNumericStats(allDiaNums).average,
      latestWeight: weightStats.latest,
      weightChange: weightStats.change,
    },
    glucoseUnit,
    weightUnit,
  };
}

function escapeCsvCell(raw: string): string {
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildDailySheetCsv(
  sheet: SpreadsheetData,
  options?: { includeEmptyDays?: boolean }
): string {
  const includeEmpty = options?.includeEmptyDays ?? false;
  const rowsToExport = includeEmpty
    ? sheet.rows
    : sheet.rows.filter(
        (r) => r.totalCount > 0 || r.dailyNote.trim().length > 0
      );

  const headers = [
    "Date",
    "Day",
    ...GLUCOSE_SHEET_COLUMNS.map((c) => `${c.label} (${sheet.glucoseUnit})`),
    `Glucose Day Avg (${sheet.glucoseUnit})`,
    "Blood Pressure (mmHg)",
    `Weight (${sheet.weightUnit})`,
    ...sheet.customColumns.map((c) =>
      c.unit ? `${c.label} (${c.unit})` : c.label
    ),
    "Daily Note",
  ];

  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const row of rowsToExport) {
    const cells = [
      row.date,
      row.weekday,
      ...GLUCOSE_SHEET_COLUMNS.map((col) =>
        row.glucoseCells[col.key].map((e) => e.displayText).join(" / ")
      ),
      row.glucoseDayAvg !== null ? String(row.glucoseDayAvg) : "",
      row.bloodPressure.map((e) => e.displayText).join(" / "),
      row.weight.map((e) => e.displayText).join(" / "),
      ...sheet.customColumns.map((col) =>
        (row.customCells[col.configId] ?? [])
          .map((e) => e.displayText)
          .join(" / ")
      ),
      row.dailyNote,
    ];
    lines.push(cells.map(escapeCsvCell).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildAllEntriesCsv(
  entries: UnifiedMeasurement[],
  timezone: string
): string {
  const tz = safeTimezone(timezone);
  const headers = [
    "Date",
    "Time",
    "Date Label",
    "Metric",
    "Value",
    "Unit",
    "Context",
    "Notes",
    "Source",
  ];
  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const item of entries) {
    const dateStr = getLocalDateString(new Date(item.measuredAt), tz);
    const timeStr = formatHHMM12h(getLocalHHMM(new Date(item.measuredAt), tz));
    const dateLabel = formatLocalDateTimeLabel(item.measuredAt, tz);
    const valueOnly = item.displayValue.replace(` ${item.unit}`, "").trim();

    lines.push(
      [
        dateStr,
        timeStr,
        dateLabel,
        item.metricLabel,
        valueOnly,
        item.unit,
        item.contextLabel,
        item.notes ?? "",
        item.source,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}
