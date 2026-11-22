import Link from "next/link";
import { Palette } from "lucide-react";
import { DailyNoteCard } from "./daily-note-card";
import { DailyProgressCard } from "./daily-progress-card";
import { GreetingHeader } from "./greeting-header";
import { MetricSummaryGrid } from "./metric-summary-grid";
import {
  MOCK_METRIC_SUMMARIES,
  MOCK_PROGRESS,
  MOCK_RECENT_MEASUREMENTS,
  MOCK_TODAY_SCHEDULE,
  MOCK_USER_NAME,
} from "./mock-dashboard-data";
import { QuickActionsBar } from "./quick-actions-bar";
import { RecentMeasurementsList } from "./recent-measurements-list";
import { TodayScheduleList } from "./today-schedule-list";

interface DashboardViewProps {
  userName?: string | null;
}

export function DashboardView({ userName }: DashboardViewProps) {
  const displayName = userName?.trim() || MOCK_USER_NAME;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <GreetingHeader name={displayName} />
        <Link
          href="/design-system"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Palette className="size-3.5" aria-hidden="true" />
          Design System
        </Link>
      </div>

      <p className="rounded-xl border border-border/80 bg-muted/60 px-3.5 py-2 text-xs text-muted-foreground">
        Preview mode: your account is connected; measurement cards still show
        sample data until Milestones 6–7 connect live tracking records.
      </p>

      <DailyProgressCard
        completed={MOCK_PROGRESS.completed}
        total={MOCK_PROGRESS.total}
      />

      <QuickActionsBar />

      <MetricSummaryGrid metrics={MOCK_METRIC_SUMMARIES} />

      <TodayScheduleList items={MOCK_TODAY_SCHEDULE} />

      <RecentMeasurementsList records={MOCK_RECENT_MEASUREMENTS} />

      <DailyNoteCard />
    </div>
  );
}
