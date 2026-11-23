import Link from "next/link";
import { Mic, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailyNoteCard } from "./daily-note-card";
import { DailyProgressCard } from "./daily-progress-card";
import { GreetingHeader } from "./greeting-header";
import {
  MetricSummaryGrid,
  type DashboardMetricCard,
} from "./metric-summary-grid";
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

  const nextTask = tasks.find(
    (t) => t.status === "pending" || t.status === "upcoming"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <GreetingHeader name={displayName} />

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/log?mode=voice">
            <Button size="default" className="gap-2 rounded-full px-4 shadow-xs" type="button">
              <Mic className="size-4" aria-hidden="true" />
              Voice Log
            </Button>
          </Link>
          <Link href="/log?mode=manual">
            <Button
              size="default"
              variant="outline"
              className="gap-1.5 rounded-full bg-card px-4"
              type="button"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Entry
            </Button>
          </Link>
          <Link
            href="/profile/tracking"
            aria-label="Tracking Settings"
            title="Tracking Settings"
          >
            <Button
              size="icon"
              variant="outline"
              className="rounded-full bg-card text-muted-foreground hover:text-foreground"
              type="button"
              aria-label="Tracking Settings"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>

      <DailyProgressCard
        completed={completedCount}
        total={tasks.length}
        nextTaskSummary={
          nextTask
            ? `Next: ${nextTask.measurementName} (${nextTask.context}) at ${nextTask.scheduledTime}`
            : undefined
        }
      />

      <MetricSummaryGrid metrics={metrics} />

      <TodayScheduleList items={tasks} todayDate={todayDate} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <RecentMeasurementsList records={recentMeasurements} />
        </div>
        <div className="lg:col-span-5">
          <DailyNoteCard
            key={`${todayDate}-${dailyNote}`}
            todayDate={todayDate}
            initialContent={dailyNote}
          />
        </div>
      </div>
    </div>
  );
}
