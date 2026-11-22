"use client";

import { useSyncExternalStore } from "react";

interface GreetingHeaderProps {
  name: string;
}

const emptySubscribe = () => () => {};

function getGreetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getClientSnapshot(): string {
  const now = new Date();
  const greeting = getGreetingForHour(now.getHours());
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(now);
  return `${greeting}|${dateLabel}`;
}

function getServerSnapshot(): string {
  return "Hello|Today's health check-in";
}

export function GreetingHeader({ name }: GreetingHeaderProps) {
  const snapshot = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const [greeting, dateLabel] = snapshot.split("|");

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-muted-foreground">{dateLabel}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {greeting}, {name}
      </h1>
    </div>
  );
}
