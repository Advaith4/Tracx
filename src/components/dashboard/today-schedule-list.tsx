import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import { StatusBadge } from "@/components/layout/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ScheduledCheckIn } from "./mock-dashboard-data";

interface TodayScheduleListProps {
  items: ScheduledCheckIn[];
}

export function TodayScheduleList({ items }: TodayScheduleListProps) {
  return (
    <section aria-labelledby="today-schedule-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2
          id="today-schedule-heading"
          className="text-sm font-medium text-muted-foreground"
        >
          Today&apos;s Tasks
        </h2>
        <Link
          href="/profile"
          className="text-xs font-medium text-primary hover:underline"
        >
          Edit schedule
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const canQuickLog =
            item.status === "pending" || item.status === "upcoming";

          return (
            <Card key={item.id} size="sm">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {item.measurementName}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.context}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" aria-hidden="true" />
                      {item.scheduledTime}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.recordedValue ? (
                    <span className="text-sm font-semibold text-foreground">
                      {item.recordedValue}
                    </span>
                  ) : null}

                  {canQuickLog ? (
                    <Link href="/log">
                      <Button size="sm" variant="secondary" type="button">
                        <Plus className="size-3.5" aria-hidden="true" />
                        Log
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
