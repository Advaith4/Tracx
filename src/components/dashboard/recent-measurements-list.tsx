import Link from "next/link";
import { Mic, PencilLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { RecentMeasurement } from "./mock-dashboard-data";

interface RecentMeasurementsListProps {
  records: RecentMeasurement[];
}

export function RecentMeasurementsList({
  records,
}: RecentMeasurementsListProps) {
  return (
    <section aria-labelledby="recent-measurements-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2
          id="recent-measurements-heading"
          className="text-sm font-medium text-muted-foreground"
        >
          Recent Measurements
        </h2>
        <Link
          href="/insights"
          className="text-xs font-medium text-primary hover:underline"
        >
          View history
        </Link>
      </div>

      <Card size="sm">
        <CardContent className="divide-y divide-border p-0">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {record.type}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    title={
                      record.source === "voice"
                        ? "Logged by voice"
                        : "Logged manually"
                    }
                  >
                    {record.source === "voice" ? (
                      <Mic className="size-3" aria-hidden="true" />
                    ) : (
                      <PencilLine className="size-3" aria-hidden="true" />
                    )}
                    <span className="capitalize">{record.source}</span>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {record.context} · {record.measuredAt}
                </span>
              </div>

              <span className="shrink-0 text-sm font-semibold text-foreground">
                {record.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
