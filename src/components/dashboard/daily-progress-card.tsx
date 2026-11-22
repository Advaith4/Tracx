import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DailyProgressCardProps {
  completed: number;
  total: number;
}

export function DailyProgressCard({
  completed,
  total,
}: DailyProgressCardProps) {
  const safeTotal = Math.max(total, 0);
  const percentage =
    safeTotal > 0 ? Math.min(Math.round((completed / safeTotal) * 100), 100) : 0;
  const pending = Math.max(safeTotal - completed, 0);

  return (
    <Card className="bg-secondary/50 ring-border">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today&apos;s Progress
            </span>
            <p className="text-base font-semibold text-foreground sm:text-lg">
              {completed} of {safeTotal} measurements recorded today
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary ring-1 ring-border">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            <span>{percentage}%</span>
          </div>
        </div>

        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-background/90 ring-1 ring-border/70"
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

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{completed} completed</span>
          <span>{pending} remaining</span>
        </div>
      </CardContent>
    </Card>
  );
}
