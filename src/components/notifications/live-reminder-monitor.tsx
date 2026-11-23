"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatTime12h } from "@/features/tracking-config/schedule-utils";
import {
  playGentleReminderChime,
  showBrowserReminderNotification,
} from "@/lib/notifications/browser-alerts";
import {
  getReminderCategoryLabel,
  isMeasurementReminderCategory,
  parseReminderMetricMeta,
  type ReminderCategory,
} from "@/lib/notifications/reminder-logic";
import type { Tables } from "@/types/database";

interface DispatchedItem {
  reminderId: string;
  logId: string | null;
  label: string;
  category: ReminderCategory;
  scheduledDate: string | null;
  scheduledTime: string;
  channel: string;
  status: string;
  errorMessage: string | null;
}

const SEEN_STORAGE_KEY = "tracx_notified_dispatch_keys_v1";

function loadSeenKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function persistSeenKeys(keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SEEN_STORAGE_KEY,
      JSON.stringify([...keys].slice(-80))
    );
  } catch {
    // Ignore storage quota errors
  }
}

function getNextReminderCheckDelayMs(reminders: Tables<"reminders">[]): number {
  const now = new Date();
  const enabled = reminders.filter((r) => r.enabled);
  if (enabled.length === 0) return 60_000;

  let nearestMs = 30_000;
  for (const rem of enabled) {
    const [hhStr, mmStr] = rem.scheduled_time.split(":");
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;

    const candidate = new Date(now);
    candidate.setHours(hh, mm, 2, 0);
    const diff = candidate.getTime() - now.getTime();
    if (diff > 500 && diff < nearestMs) {
      nearestMs = diff;
    }
  }
  return Math.max(2_000, nearestMs);
}

export function LiveReminderMonitor() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const seenKeysRef = useRef<Set<string> | null>(null);

  const { data: reminders = [] } = useQuery<Tables<"reminders">[]>({
    queryKey: ["reminders"],
    staleTime: 25_000,
    queryFn: async () => {
      const res = await fetch("/api/reminders");
      if (!res.ok) return [];
      const json = await res.json().catch(() => null);
      return Array.isArray(json?.data) ? json.data : [];
    },
  });

  const snoozeNotification = useCallback(
    async (logId: string, label: string) => {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "snooze",
            logId,
            snoozeMinutes: 15,
          }),
        });
        if (res.ok) {
          toast.info(`Snoozed "${label}" for 15 minutes`);
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      } catch {
        // Non-blocking
      }
    },
    [queryClient]
  );

  const checkDueReminders = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (inFlightRef.current) return;
      if (!force && now - lastCheckAtRef.current < 10_000) return;

      inFlightRef.current = true;
      lastCheckAtRef.current = now;

      try {
        const res = await fetch("/api/notifications/dispatch", {
          method: "POST",
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const dispatched: DispatchedItem[] = Array.isArray(
          json?.data?.dispatched
        )
          ? json.data.dispatched
          : [];

        if (dispatched.length === 0) return;

        if (!seenKeysRef.current) {
          seenKeysRef.current = loadSeenKeys();
        }
        const seen = seenKeysRef.current;

        let anyNew = false;
        for (const item of dispatched) {
          const dedupeKey =
            item.logId ||
            `${item.reminderId}:${new Date().toISOString().slice(0, 16)}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          anyNew = true;

          if (item.status !== "sent" && item.channel !== "in_app") {
            continue;
          }

          const categoryLabel = getReminderCategoryLabel(item.category);
          const targetUrl = isMeasurementReminderCategory(item.category)
            ? `/log?metric=${item.category}`
            : "/calendar";

          toast.info(`${item.label}`, {
            description: `${categoryLabel} · Scheduled for ${formatTime12h(item.scheduledTime)}`,
            duration: 12_000,
            action: {
              label: isMeasurementReminderCategory(item.category)
                ? "Log now"
                : "View Calendar",
              onClick: () => router.push(targetUrl),
            },
            cancel: item.logId
              ? {
                  label: "Snooze 15m",
                  onClick: () =>
                    void snoozeNotification(item.logId as string, item.label),
                }
              : undefined,
          });

          // Show OS-level notification if permission was granted (and Web Push didn't already send)
          if (item.channel !== "push") {
            void showBrowserReminderNotification({
              title: `Tracx Reminder: ${item.label}`,
              body: `${categoryLabel} (${formatTime12h(item.scheduledTime)})`,
              url: targetUrl,
              tag: `tracx-rem-${item.reminderId}`,
            });
          }
        }

        if (anyNew) {
          persistSeenKeys(seen);
          playGentleReminderChime();
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["calendar"] });
        }
      } catch {
        // Silent background check; retries on next tick
      } finally {
        inFlightRef.current = false;
      }
    },
    [queryClient, router, snoozeNotification]
  );

  useEffect(() => {
    void checkDueReminders(true);
  }, [checkDueReminders]);

  useEffect(() => {
    const enabledCount = reminders.filter((r) => {
      if (!r.enabled) return false;
      const meta = parseReminderMetricMeta(r.metric_type);
      return Boolean(meta.category);
    }).length;

    if (enabledCount === 0) return;

    let timerId: number | undefined;

    const scheduleNext = () => {
      const delay = getNextReminderCheckDelayMs(reminders);
      timerId = window.setTimeout(() => {
        void checkDueReminders(false).finally(scheduleNext);
      }, delay);
    };

    scheduleNext();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void checkDueReminders(false);
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [reminders, checkDueReminders]);

  return null;
}
