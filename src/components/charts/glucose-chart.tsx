"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Droplets } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import type {
  GlucoseContextFilter,
  GlucosePoint,
} from "@/lib/calculations/analytics";

interface GlucoseChartProps {
  points: GlucosePoint[];
  unit: string;
  filter: GlucoseContextFilter;
}

interface ChartRow {
  dateLabel: string;
  fullLabel: string;
  contextLabel: string;
  unit: string;
  fastingValue?: number;
  beforeValue?: number;
  afterValue?: number;
  singleValue?: number;
}

function GlucoseTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow; value?: number }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const row = item.payload;

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">
        {item.value} {row.unit}
      </p>
      <p className="text-muted-foreground">{row.contextLabel}</p>
      <p className="text-[11px] text-muted-foreground">{row.fullLabel}</p>
    </div>
  );
}

export function GlucoseChart({ points, unit, filter }: GlucoseChartProps) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={Droplets}
        title="No glucose readings in this range"
        description="Adjust your date range or context filter, or log a reading to see trends."
      />
    );
  }

  const splitByContext = filter === "all";
  const rows: ChartRow[] = points.map((p) => ({
    dateLabel: p.dateLabel,
    fullLabel: p.fullLabel,
    contextLabel: p.contextLabel,
    unit: p.unit,
    ...(splitByContext
      ? {
          fastingValue: p.contextGroup === "fasting" ? p.value : undefined,
          beforeValue: p.contextGroup === "before" ? p.value : undefined,
          afterValue:
            p.contextGroup === "after" || p.contextGroup === "other"
              ? p.value
              : undefined,
        }
      : { singleValue: p.value }),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            unit={` ${unit}`}
            width={68}
          />
          <Tooltip content={<GlucoseTooltip />} />
          {splitByContext ? (
            <>
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="fastingValue"
                name="Fasting"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="beforeValue"
                name="Before meal"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="afterValue"
                name="After meal"
                stroke="var(--chart-3)"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="singleValue"
              name="Glucose"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
