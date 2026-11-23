"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  MinusCircle,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import { StatusBadge } from "@/components/layout/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TodayScheduledTask } from "@/features/tracking-config/schedule-utils";

export interface DashboardTaskItem extends TodayScheduledTask {
  recordedValue?: string;
}

interface TodayScheduleListProps {
  items: DashboardTaskItem[];
  todayDate: string;
}

export function TodayScheduleList({ items, todayDate }: TodayScheduleListProps) {
  const router = useRouter();
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  async function handleSkip(item: DashboardTaskItem) {
    setSkippingId(item.id);
    try {
      const response = await fetch("/api/measurements/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_type: item.metricType,
          tracking_config_id: item.configId,
          scheduled_date: todayDate,
          context_label: item.context,
        }),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't mark task as skipped.");
        return;
      }
      toast.success("Marked as skipped");
      router.refresh();
    } catch {
      toast.error("Couldn't mark task as skipped. Check your connection.");
    } finally {
      setSkippingId(null);
    }
  }

  const dueNowTasks = items.filter(
    (item) => item.status === "pending" || item.status === "missed"
  );
  const upcomingTasks = items.filter((item) => item.status === "upcoming");
  const finishedTasks = items.filter(
    (item) =>
      item.status === "recorded" ||
      item.status === "late" ||
      item.status === "skipped"
  );

  function renderTaskRow(item: DashboardTaskItem, highlight: boolean) {
    const canAction =
      item.status === "pending" ||
      item.status === "upcoming" ||
      item.status === "missed";

    return (
      <div
        key={item.id}
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors ${
          highlight ? "bg-amber-50/40 dark:bg-amber-950/15" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="hidden w-16 shrink-0 flex-col text-left sm:flex">
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {item.scheduledTime}
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {item.measurementName}
              </span>
              <StatusBadge status={item.status} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{item.context}</span>
              <span className="sm:hidden" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1 sm:hidden tabular-nums">
                <Clock className="size-3" aria-hidden="true" />
                {item.scheduledTime}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.recordedValue ? (
            <span className="rounded-lg bg-secondary/70 px-2.5 py-1 text-xs font-semibold text-secondary-foreground tabular-nums">
              {item.recordedValue}
            </span>
          ) : null}

          {canAction ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={skippingId === item.id}
                onClick={() => void handleSkip(item)}
                className="text-muted-foreground hover:text-foreground"
                title="Mark as skipped"
              >
                <MinusCircle className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Skip</span>
              </Button>
              <Link
                href={`/log?metric=${item.metricType}&context=${encodeURIComponent(item.context)}`}
              >
                <Button
                  size="sm"
                  variant={highlight ? "default" : "secondary"}
                  type="button"
                  className="rounded-lg"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Log
                </Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="today-schedule-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2
            id="today-schedule-heading"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Today&apos;s Schedule
          </h2>
          {items.length > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
              {dueNowTasks.length + upcomingTasks.length} remaining
            </span>
          ) : null}
        </div>

        <Link
          href="/profile/tracking"
          className="text-xs font-medium text-primary hover:underline"
        >
          Edit schedule
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No check-ins scheduled for today"
          description="You can still log any measurement manually or add scheduled times in your tracking configuration."
          action={
            <Link href="/profile/tracking">
              <Button size="lg" variant="outline" type="button">
                Edit Schedule
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden border-border/80">
          <CardContent className="p-0">
            {dueNowTasks.length > 0 ? (
              <div>
                <div className="border-b border-border/70 bg-amber-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Due Now ({dueNowTasks.length})
                </div>
                <div className="divide-y divide-border/70">
                  {dueNowTasks.map((item) => renderTaskRow(item, true))}
                </div>
              </div>
            ) : null}

            {upcomingTasks.length > 0 ? (
              <div className={dueNowTasks.length > 0 ? "border-t border-border/80" : ""}>
                <div className="border-b border-border/70 bg-muted/35 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Later Today ({upcomingTasks.length})
                </div>
                <div className="divide-y divide-border/70">
                  {upcomingTasks.map((item) => renderTaskRow(item, false))}
                </div>
              </div>
            ) : null}

            {finishedTasks.length > 0 ? (
              <div
                className={
                  dueNowTasks.length > 0 || upcomingTasks.length > 0
                    ? "border-t border-border/80"
                    : ""
                }
              >
                <button
                  type="button"
                  onClick={() => setShowCompleted((prev) => !prev)}
                  className="flex w-full items-center justify-between bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <span>
                    Completed &amp; Skipped ({finishedTasks.length})
                  </span>
                  {showCompleted ? (
                    <ChevronUp className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  )}
                </button>
                {showCompleted ? (
                  <div className="divide-y divide-border/70 border-t border-border/70">
                    {finishedTasks.map((item) => renderTaskRow(item, false))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
