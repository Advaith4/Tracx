"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import type { CustomMetricPoint } from "@/lib/calculations/analytics";

interface CustomMetricChartProps {
  label: string;
  unit: string;
  points: CustomMetricPoint[];
}

function CustomMetricTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CustomMetricPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-border/70">
      <p className="font-semibold tabular-nums">
        {row.value} {row.unit}
      </p>
      <p className="text-[11px] text-muted-foreground">{row.fullLabel}</p>
    </div>
  );
}

export function CustomMetricChart({
  label,
  unit,
  points,
}: CustomMetricChartProps) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title={`No numeric ${label.toLowerCase()} readings in this range`}
        description="Log numeric entries for this custom metric or adjust the date range to see its trend."
      />
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 10, right: 12, left: -8, bottom: 4 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="var(--border)"
          />
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
            unit={unit ? ` ${unit}` : ""}
            width={64}
          />
          <Tooltip content={<CustomMetricTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name={unit ? `${label} (${unit})` : label}
            stroke="var(--chart-4)"
            strokeWidth={2.5}
            dot={{ r: 3.5 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
