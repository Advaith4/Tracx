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
import { Scale } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import type { WeightPoint } from "@/lib/calculations/analytics";
import type { WeightUnit } from "@/types/database";

interface WeightChartProps {
  points: WeightPoint[];
  unit: WeightUnit;
}

function WeightTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: WeightPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">
        {row.value} {row.unit}
      </p>
      <p className="text-[11px] text-muted-foreground">{row.fullLabel}</p>
    </div>
  );
}

export function WeightChart({ points, unit }: WeightChartProps) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No weight records in this range"
        description="Adjust your date range or log a weight check-in to see your chronological record."
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
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
            width={62}
          />
          <Tooltip content={<WeightTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name={`Weight (${unit})`}
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
