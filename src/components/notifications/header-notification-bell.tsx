"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationLogSummary {
  id: string;
  read_at: string | null;
}

export function HeaderNotificationBell() {
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["notifications", "unread-count"],
    staleTime: 25_000,
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return 0;
      const json = await res.json().catch(() => null);
      const list: NotificationLogSummary[] = Array.isArray(json?.data)
        ? json.data
        : [];
      return list.filter((item) => !item.read_at).length;
    },
  });

  return (
    <Link
      href="/notifications"
      aria-label={
        unreadCount > 0
          ? `Notifications (${unreadCount} unread)`
          : "Notifications"
      }
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "relative rounded-full hover:bg-muted/80"
      )}
    >
      <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground shadow-xs">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
