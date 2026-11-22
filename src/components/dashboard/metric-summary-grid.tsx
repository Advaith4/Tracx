import { Activity, Droplets, Scale, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricSummary } from "./mock-dashboard-data";

const METRIC_ICONS: Record<MetricSummary["id"], LucideIcon> = {
  glucose: Droplets,
  blood_pressure: Activity,
  weight: Scale,
};

interface MetricSummaryGridProps {
  metrics: MetricSummary[];
}

export function MetricSummaryGrid({ metrics }: MetricSummaryGridProps) {
  return (
    <section aria-labelledby="metrics-summary-heading" className="flex flex-col gap-3">
      <h2
        id="metrics-summary-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        Latest Readings
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.id];

          return (
            <Card key={metric.id} size="sm">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {metric.label}
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    {metric.latestValue}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {metric.unit}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {metric.context}
                  </span>
                  <span>{metric.subtitle}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
