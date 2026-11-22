import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  rows?: number;
  className?: string;
}

export function LoadingState({ rows = 3, className }: LoadingStateProps) {
  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      role="status"
      aria-label="Loading content"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index}>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed shadow-none", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div className="flex max-w-sm flex-col gap-1">
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something didn't load right",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Card
      className={cn(
        "border-destructive/30 bg-destructive/5 shadow-none",
        className
      )}
      role="alert"
    >
      <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <div className="flex max-w-sm flex-col gap-1">
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>
        {onRetry ? (
          <Button variant="outline" size="lg" onClick={onRetry} type="button">
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
