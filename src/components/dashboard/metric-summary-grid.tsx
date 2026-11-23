import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Droplets,
  Scale,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

const METRIC_META: Record<
  MetricType,
  { icon: LucideIcon; tintClass: string }
> = {
  glucose: {
    icon: Droplets,
    tintClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  },
  blood_pressure: {
    icon: Activity,
    tintClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  },
  weight: {
    icon: Scale,
    tintClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  custom: {
    icon: SlidersHorizontal,
    tintClass: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  },
};

function getGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
}

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
          className="text-sm font-semibold tracking-tight text-foreground"
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
        <div className={cn("grid gap-3", getGridClass(metrics.length))}>
          {metrics.map((metric) => {
            const meta = METRIC_META[metric.metricType];
            const Icon = meta.icon;
            const hasReading = metric.latestValue !== "--";
            const targetHref = hasReading
              ? "/insights"
              : `/log?metric=${metric.metricType}`;

            return (
              <Link key={metric.id} href={targetHref} className="group block">
                <Card
                  size="sm"
                  className="h-full border-border/80 transition-all group-hover:border-primary/40 group-hover:shadow-sm"
                >
                  <CardContent className="flex h-full flex-col justify-between gap-3 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-lg",
                            meta.tintClass
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="truncate text-xs font-medium text-muted-foreground">
                          {metric.label}
                        </span>
                      </div>
                      <ArrowUpRight
                        className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                        {metric.latestValue}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {metric.unit}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      <span className="truncate font-medium text-foreground/85">
                        {metric.context}
                      </span>
                      <span className="truncate text-[11px]">
                        {metric.subtitle}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
