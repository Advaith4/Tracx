import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Hourglass,
  MinusCircle,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MeasurementStatus =
  | "upcoming"
  | "pending"
  | "recorded"
  | "late"
  | "skipped"
  | "missed";

const STATUS_CONFIG: Record<
  MeasurementStatus,
  {
    label: string;
    icon: LucideIcon;
    className: string;
  }
> = {
  recorded: {
    label: "Recorded",
    icon: CheckCircle2,
    className:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/60",
  },
  upcoming: {
    label: "Upcoming",
    icon: Hourglass,
    className:
      "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800/60",
  },
  late: {
    label: "Late",
    icon: TimerOff,
    className:
      "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800/60",
  },
  skipped: {
    label: "Skipped",
    icon: MinusCircle,
    className:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700",
  },
  missed: {
    label: "Missed",
    icon: AlertCircle,
    className:
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/60",
  },
};

interface StatusBadgeProps {
  status: MeasurementStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
