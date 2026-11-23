"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import type { BloodPressurePoint } from "@/lib/calculations/analytics";

interface BloodPressureChartProps {
  points: BloodPressurePoint[];
  systolicMax?: number | null;
  diastolicMax?: number | null;
}

function BloodPressureTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BloodPressurePoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-border/70">
      <p className="font-semibold tabular-nums">
        {row.systolic}/{row.diastolic} mmHg
      </p>
      {row.pulse ? (
        <p className="text-muted-foreground tabular-nums">Pulse: {row.pulse} bpm</p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">{row.fullLabel}</p>
    </div>
  );
}

export function BloodPressureChart({
  points,
  systolicMax,
  diastolicMax,
}: BloodPressureChartProps) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No blood pressure readings in this range"
        description="Adjust your date range or log a reading to inspect systolic and diastolic trends."
      />
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
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
            width={44}
          />
          <Tooltip content={<BloodPressureTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {systolicMax ? (
            <ReferenceLine
              y={systolicMax}
              stroke="var(--chart-1)"
              strokeDasharray="4 4"
            />
          ) : null}
          {diastolicMax ? (
            <ReferenceLine
              y={diastolicMax}
              stroke="var(--chart-2)"
              strokeDasharray="4 4"
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="systolic"
            name="Systolic (mmHg)"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            name="Diastolic (mmHg)"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
