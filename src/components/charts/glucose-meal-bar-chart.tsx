"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Droplets } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import type { MealComparisonBucket } from "@/lib/calculations/insights-synthesis";

interface GlucoseMealBarChartProps {
  buckets: MealComparisonBucket[];
  unit: string;
}

function MealBarTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: MealComparisonBucket }>;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-border/70">
      <p className="font-semibold text-foreground">{row.label}</p>
      <p className="font-semibold text-primary tabular-nums">
        Avg: {row.average} {unit}
      </p>
      <p className="text-muted-foreground tabular-nums">
        Range: {row.min}–{row.max} {unit} ({row.count} readings)
      </p>
      {row.withinTargetCount !== null && row.referenceMax !== null ? (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {row.withinTargetCount}/{row.count} ≤ {row.referenceMax} {unit}
        </p>
      ) : null}
    </div>
  );
}

export function GlucoseMealBarChart({
  buckets,
  unit,
}: GlucoseMealBarChartProps) {
  const chartData = buckets.filter((b) => b.average !== null);

  if (chartData.length === 0) {
    return (
      <EmptyState
        icon={Droplets}
        title="No meal-context glucose data yet"
        description="Log fasting and post-meal readings to compare how each meal behaves."
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="var(--border)"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            domain={[0, "auto"]}
            unit={` ${unit}`}
            width={68}
          />
          <Tooltip content={<MealBarTooltip unit={unit} />} />
          <Bar dataKey="average" radius={[8, 8, 0, 0]} maxBarSize={44}>
            {chartData.map((entry) => (
              <Cell
                key={entry.key}
                fill={
                  entry.key === "fasting" || entry.key.startsWith("before")
                    ? "var(--chart-1)"
                    : "var(--chart-3)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
