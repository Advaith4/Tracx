import Link from "next/link";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { DailyNoteCard } from "./daily-note-card";
import { DailyProgressCard } from "./daily-progress-card";
import { GreetingHeader } from "./greeting-header";
import {
  MetricSummaryGrid,
  type DashboardMetricCard,
} from "./metric-summary-grid";
import { QuickActionsBar } from "./quick-actions-bar";
import {
  RecentMeasurementsList,
  type RecentMeasurement,
} from "./recent-measurements-list";
import {
  TodayScheduleList,
  type DashboardTaskItem,
} from "./today-schedule-list";

interface DashboardViewProps {
  userName?: string | null;
  todayDate: string;
  metrics: DashboardMetricCard[];
  tasks: DashboardTaskItem[];
  recentMeasurements: RecentMeasurement[];
  dailyNote: string;
}

export function DashboardView({
  userName,
  todayDate,
  metrics,
  tasks,
  recentMeasurements,
  dailyNote,
}: DashboardViewProps) {
  const displayName = userName?.trim() || "there";
  const completedCount = tasks.filter(
    (t) => t.status === "recorded" || t.status === "late"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <GreetingHeader name={displayName} />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/assistant"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-secondary/60"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Ask Assistant
          </Link>
          <Link
            href="/profile/tracking"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Tracking Settings
          </Link>
        </div>
      </div>

      <DailyProgressCard completed={completedCount} total={tasks.length} />

      <QuickActionsBar />

      <MetricSummaryGrid metrics={metrics} />

      <TodayScheduleList items={tasks} todayDate={todayDate} />

      <RecentMeasurementsList records={recentMeasurements} />

      <DailyNoteCard
        key={`${todayDate}-${dailyNote}`}
        todayDate={todayDate}
        initialContent={dailyNote}
      />
    </div>
  );
}
