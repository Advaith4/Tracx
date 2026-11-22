import Link from "next/link";
import {
  Activity,
  Droplets,
  Scale,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricType } from "@/types/database";

export interface DashboardMetricCard {
  id: string;
  metricType: MetricType;
  label: string;
  latestValue: string;
  unit: string;
  context: string;
  subtitle: string;
}

const METRIC_ICONS: Record<MetricType, LucideIcon> = {
  glucose: Droplets,
  blood_pressure: Activity,
  weight: Scale,
  custom: SlidersHorizontal,
};

interface MetricSummaryGridProps {
  metrics: DashboardMetricCard[];
}

export function MetricSummaryGrid({ metrics }: MetricSummaryGridProps) {
  return (
    <section
      aria-labelledby="metrics-summary-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <h2
          id="metrics-summary-heading"
          className="text-sm font-medium text-muted-foreground"
        >
          Active Metrics
        </h2>
        <Link
          href="/profile/tracking"
          className="text-xs font-medium text-primary hover:underline"
        >
          Configure metrics
        </Link>
      </div>

      {metrics.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No metrics selected for dashboard"
          description="Enable a metric and turn on 'Show on Dashboard' in your tracking configuration."
          action={
            <Link href="/profile/tracking">
              <Button size="lg" variant="secondary" type="button">
                Open Tracking Settings
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = METRIC_ICONS[metric.metricType];

            return (
              <Card key={metric.id} size="sm">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {metric.label}
                    </span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
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
                    <span className="truncate font-medium text-foreground/80">
                      {metric.context}
                    </span>
                    <span className="truncate">{metric.subtitle}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
