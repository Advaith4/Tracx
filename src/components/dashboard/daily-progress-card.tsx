import { CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DailyProgressCardProps {
  completed: number;
  total: number;
  nextTaskSummary?: string;
}

export function DailyProgressCard({
  completed,
  total,
  nextTaskSummary,
}: DailyProgressCardProps) {
  const safeTotal = Math.max(total, 0);
  const percentage =
    safeTotal > 0 ? Math.min(Math.round((completed / safeTotal) * 100), 100) : 0;
  const pending = Math.max(safeTotal - completed, 0);

  return (
    <Card className="border-border/80 bg-gradient-to-br from-secondary/55 via-card to-card shadow-2xs">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Daily Adherence
            </span>
            <p className="text-base font-semibold tracking-tight text-foreground tabular-nums sm:text-lg">
              {completed} of {safeTotal} scheduled check-ins completed
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-2xs ring-1 ring-border tabular-nums">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            <span>{percentage}%</span>
          </div>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted/80"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Today's measurement completion"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {nextTaskSummary ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground/85">
              <Clock className="size-3.5 text-primary" aria-hidden="true" />
              {nextTaskSummary}
            </span>
          ) : (
            <span>
              {safeTotal > 0 && pending === 0
                ? "All scheduled check-ins wrapped up for today."
                : "No scheduled check-ins for today."}
            </span>
          )}
          <span className="tabular-nums">{pending} remaining</span>
        </div>
      </CardContent>
    </Card>
  );
}
