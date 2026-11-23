"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  HeartPulse,
  Loader2,
  Plus,
  Scale,
  StickyNote,
  Table2,
  Trash2,
} from "lucide-react";
import { StatusBadge } from "@/components/layout/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  CalendarDayStats,
  CalendarMonthPayload,
} from "@/features/calendar/service";
import {
  getBrowserNotificationPermission,
  playGentleReminderChime,
  requestBrowserNotificationPermission,
  showBrowserReminderNotification,
  type BrowserNotificationPermissionState,
} from "@/lib/notifications/browser-alerts";
import {
  getReminderCategoryLabel,
  type ReminderCategory,
} from "@/lib/notifications/reminder-logic";
import { cn } from "@/lib/utils";
import type { NotificationChannel } from "@/types/database";

const emptySubscribe = () => () => {};
const getServerNotificationPermission =
  (): BrowserNotificationPermissionState => "default";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"] as const;

const REMINDER_PRESETS: Array<{
  label: string;
  category: ReminderCategory;
  defaultTime: string;
}> = [
  { label: "Fasting blood sugar", category: "glucose", defaultTime: "07:30" },
  { label: "After-lunch sugar", category: "glucose", defaultTime: "13:30" },
  { label: "Blood pressure check", category: "blood_pressure", defaultTime: "08:30" },
  { label: "Prenatal vitamin", category: "medication", defaultTime: "09:00" },
  { label: "OB clinic checkup", category: "appointment", defaultTime: "10:30" },
];

function formatMonthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 15)));
}

function formatFullDateTitle(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function stepMonthString(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 15));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getDefaultUpcomingTime(
  isToday: boolean,
  timeZone: string
): string {
  if (!isToday) return "09:00";
  const plusTwoMin = new Date(Date.now() + 2 * 60_000);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(plusTwoMin);
    const hh = parts.find((p) => p.type === "hour")?.value ?? "09";
    const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hh === "24" ? "00" : hh}:${mm}`;
  } catch {
    return "09:00";
  }
}

interface CalendarWorkspaceProps {
  userId: string;
  initialData: CalendarMonthPayload;
  initialSelectedDate?: string;
}

export function CalendarWorkspace({
  userId,
  initialData,
  initialSelectedDate,
}: CalendarWorkspaceProps) {
  const queryClient = useQueryClient();

  const resolvedInitialDate =
    initialSelectedDate && initialData.days[initialSelectedDate]
      ? initialSelectedDate
      : initialData.days[initialData.todayDate]
        ? initialData.todayDate
        : `${initialData.month}-01`;

  const [currentMonth, setCurrentMonth] = useState(initialData.month);
  const [selectedDate, setSelectedDate] = useState(resolvedInitialDate);
  const browserPermission = useSyncExternalStore(
    emptySubscribe,
    getBrowserNotificationPermission,
    getServerNotificationPermission
  );
  const [permissionOverride, setPermissionOverride] =
    useState<BrowserNotificationPermissionState | null>(null);
  const permissionState = permissionOverride ?? browserPermission;

  // Reminder quick-add drawer/panel inside selected date
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [remMode, setRemMode] = useState<"single_date" | "recurring">(
    "single_date"
  );
  const [remCategory, setRemCategory] = useState<ReminderCategory>("glucose");
  const [remLabel, setRemLabel] = useState("");
  const [remTime, setRemTime] = useState("09:00");
  const [remChannel, setRemChannel] = useState<NotificationChannel>("in_app");
  const [remDaysOfWeek, setRemDaysOfWeek] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6,
  ]);
  const [remFollowUp, setRemFollowUp] = useState("15");

  // Daily note editor synced cleanly to currently selected date
  const [noteDraftMap, setNoteDraftMap] = useState<Record<string, string>>({});

  const { data = initialData, isFetching } = useQuery<CalendarMonthPayload>({
    queryKey: ["calendar", userId, currentMonth],
    initialData:
      currentMonth === initialData.month ? initialData : undefined,
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar?month=${encodeURIComponent(currentMonth)}`
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't load calendar.");
      }
      return json.data as CalendarMonthPayload;
    },
  });

  const activeDay: CalendarDayStats | undefined =
    data.days[selectedDate] ?? data.days[`${data.month}-01`];

  const noteValue =
    activeDay && activeDay.date in noteDraftMap
      ? noteDraftMap[activeDay.date]
      : (activeDay?.dailyNote ?? "");

  const calendarCells = useMemo(() => {
    const cells: Array<CalendarDayStats | null> = [];
    for (let i = 0; i < data.firstWeekdayOfMonth; i++) {
      cells.push(null);
    }
    for (let dayNum = 1; dayNum <= data.daysInMonth; dayNum++) {
      const dateStr = `${data.month}-${String(dayNum).padStart(2, "0")}`;
      cells.push(data.days[dateStr] ?? null);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [data]);

  const monthSummary = useMemo(() => {
    const dayList = Object.values(data.days);
    const activeDays = dayList.filter((d) => d.totalLogs > 0).length;
    const totalReadings = dayList.reduce((acc, d) => acc + d.totalLogs, 0);
    const pinnedReminders = data.allReminders.filter(
      (r) => r.scheduledDate?.startsWith(data.month) && r.enabled
    ).length;
    return { activeDays, totalReadings, pinnedReminders };
  }, [data]);

  function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    if (showAddReminder) {
      setRemTime(
        getDefaultUpcomingTime(dateStr === data.todayDate, data.timezone)
      );
    }
  }

  function handleStepMonth(delta: number) {
    const nextMonth = stepMonthString(currentMonth, delta);
    setCurrentMonth(nextMonth);
    if (nextMonth === data.todayDate.slice(0, 7)) {
      setSelectedDate(data.todayDate);
    } else {
      setSelectedDate(`${nextMonth}-01`);
    }
  }

  function handleJumpToToday() {
    const todayMonth = data.todayDate.slice(0, 7);
    setCurrentMonth(todayMonth);
    setSelectedDate(data.todayDate);
  }

  async function handleEnableAlerts() {
    const perm = await requestBrowserNotificationPermission();
    setPermissionOverride(perm);
    if (perm === "granted") {
      playGentleReminderChime();
      await showBrowserReminderNotification({
        title: "Tracx Live Alerts Enabled",
        body: "You'll receive real-time alerts here when your reminders are due.",
        url: `/calendar?date=${selectedDate}`,
      });
      toast.success("Real-time browser alerts enabled");
    } else if (perm === "denied") {
      toast.error(
        "Browser notifications are blocked. Allow notifications for this site in your browser settings."
      );
    }
  }

  async function handleSendTestAlert() {
    playGentleReminderChime();
    toast.info("Sample Reminder: Check-in due", {
      description:
        "This is how your real-time calendar reminders will alert you.",
      duration: 8_000,
    });

    if (permissionState === "granted") {
      await showBrowserReminderNotification({
        title: "Tracx Reminder Test",
        body: "Real-time notifications are ready for your scheduled check-ins.",
        url: `/calendar?date=${selectedDate}`,
      });
    } else if (permissionState === "default") {
      await handleEnableAlerts();
    }
  }

  const createReminderMutation = useMutation({
    mutationFn: async () => {
      const targetDate = activeDay?.date ?? selectedDate;
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_type: remCategory,
          scheduled_date: remMode === "single_date" ? targetDate : null,
          label: remLabel.trim(),
          scheduled_time: remTime,
          timezone: data.timezone,
          days_of_week:
            remMode === "recurring"
              ? remDaysOfWeek
              : [activeDay?.weekday ?? 0],
          channel: remChannel,
          enabled: true,
          follow_up_minutes: remFollowUp.trim() ? Number(remFollowUp) : null,
          snooze_minutes: 15,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't save reminder.");
      }
      return json.data;
    },
    onSuccess: async () => {
      setRemLabel("");
      setShowAddReminder(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["reminders"] }),
      ]);
      toast.success(
        remMode === "single_date"
          ? `Reminder set for ${formatFullDateTitle(activeDay?.date ?? selectedDate)} at ${remTime}`
          : "Recurring weekly reminder saved"
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const toggleReminderMutation = useMutation({
    mutationFn: async (params: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/reminders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: params.enabled }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't update reminder.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't remove reminder.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder removed");
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (params: { date: string; content: string }) => {
      const res = await fetch("/api/daily-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_date: params.date,
          content: params.content.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't save daily note.");
      }
      return json.data;
    },
    onSuccess: (_data, vars) => {
      setNoteDraftMap((prev) => {
        const next = { ...prev };
        delete next[vars.date];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast.success("Daily note saved");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function toggleRecurringWeekday(dayIdx: number) {
    setRemDaysOfWeek((prev) => {
      if (prev.includes(dayIdx)) {
        return prev.length === 1 ? prev : prev.filter((d) => d !== dayIdx);
      }
      return [...prev, dayIdx].sort((a, b) => a - b);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Real-time notification readiness bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              permissionState === "granted"
                ? "bg-primary/12 text-primary"
                : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
            )}
          >
            <BellRing className="size-4" aria-hidden="true" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-foreground">
              {permissionState === "granted"
                ? "Real-time browser & in-app alerts are active"
                : "In-app live alerts are active"}
            </p>
            <p className="text-muted-foreground">
              {permissionState === "granted"
                ? "Reminders pop up automatically at their exact scheduled time with sound and snooze."
                : permissionState === "denied"
                  ? "Browser popups are blocked in site settings — in-app toast alerts still notify you while Tracx is open."
                  : "Enable browser popups so reminders notify you even when another tab is focused."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {permissionState !== "granted" && permissionState !== "denied" && permissionState !== "unsupported" ? (
            <Button
              size="sm"
              type="button"
              onClick={() => void handleEnableAlerts()}
            >
              <Bell className="size-3.5" aria-hidden="true" />
              Enable Browser Alerts
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => void handleSendTestAlert()}
          >
            Test Alert
          </Button>
          <Link
            href="/logbook"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Table2 className="size-3.5 text-primary" aria-hidden="true" />
            Excel Sheet
          </Link>
          <Link
            href="/profile/reminders"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Push &amp; Quiet Hours
          </Link>
        </div>
      </div>

      {/* Month KPIs strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Active Days ({formatMonthTitle(data.month).split(" ")[0]})
          </span>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {monthSummary.activeDays} / {data.daysInMonth}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Readings This Month
          </span>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {monthSummary.totalReadings}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Date-Pinned Reminders
          </span>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {monthSummary.pinnedReminders}
          </p>
        </div>
      </div>

      {/* Main Split View: Calendar Grid + Selected Date Inspector */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Interactive Monthly Calendar */}
        <Card className="lg:col-span-7">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                <CardTitle>{formatMonthTitle(currentMonth)}</CardTitle>
                {isFetching ? (
                  <Loader2
                    className="size-3.5 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : null}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="icon-sm"
                  variant="outline"
                  type="button"
                  aria-label="Previous month"
                  onClick={() => handleStepMonth(-1)}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={handleJumpToToday}
                >
                  Today
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  type="button"
                  aria-label="Next month"
                  onClick={() => handleStepMonth(1)}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Subtle legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Glucose
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                BP
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                Weight
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bell className="size-3 text-primary" aria-hidden="true" />
                Reminder
              </span>
              <span className="inline-flex items-center gap-1.5">
                <StickyNote className="size-3 text-sky-600" aria-hidden="true" />
                Note
              </span>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-2">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {WEEKDAY_HEADERS.map((wd) => (
                <div key={wd} className="py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((day, idx) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[68px] rounded-xl bg-muted/20 sm:min-h-[78px]"
                    />
                  );
                }

                const dayNum = Number(day.date.slice(8));
                const isSelected = day.date === activeDay?.date;
                const enabledReminders = day.reminders.filter((r) => r.enabled);
                const hasDatePinned = enabledReminders.some(
                  (r) => r.isDateSpecific
                );
                const hasSentReminder = day.reminders.some(
                  (r) => r.notificationStatus === "sent"
                );

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => handleSelectDate(day.date)}
                    aria-pressed={isSelected}
                    aria-label={`${formatFullDateTitle(day.date)}, ${day.totalLogs} logged measurements, ${enabledReminders.length} reminders`}
                    className={cn(
                      "group relative flex min-h-[68px] flex-col justify-between rounded-xl border p-1.5 text-left transition-all sm:min-h-[78px] sm:p-2",
                      isSelected
                        ? "border-primary bg-primary/8 ring-2 ring-primary/35"
                        : day.isToday
                          ? "border-primary/45 bg-card hover:bg-muted/40"
                          : day.totalLogs > 0
                            ? "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30"
                            : "border-border/45 bg-muted/20 hover:border-border hover:bg-muted/35"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                          day.isToday
                            ? "bg-primary text-primary-foreground"
                            : isSelected
                              ? "text-primary"
                              : "text-foreground"
                        )}
                      >
                        {dayNum}
                      </span>

                      {enabledReminders.length > 0 ? (
                        <span
                          title={`${enabledReminders.length} active reminder(s)`}
                          className={cn(
                            "inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-semibold",
                            hasDatePinned
                              ? "bg-primary/15 text-primary"
                              : hasSentReminder
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "text-muted-foreground"
                          )}
                        >
                          <Bell className="size-2.5" aria-hidden="true" />
                          {hasDatePinned || enabledReminders.length > 1
                            ? enabledReminders.length
                            : null}
                        </span>
                      ) : null}
                    </div>

                    {/* Metric dots + count + note dot */}
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <div className="flex flex-wrap items-center gap-1">
                        {day.glucose.count > 0 ? (
                          <span
                            className="size-1.5 rounded-full bg-emerald-500"
                            title={`${day.glucose.count} glucose`}
                          />
                        ) : null}
                        {day.bloodPressure.count > 0 ? (
                          <span
                            className="size-1.5 rounded-full bg-rose-500"
                            title={`${day.bloodPressure.count} blood pressure`}
                          />
                        ) : null}
                        {day.weight.count > 0 ? (
                          <span
                            className="size-1.5 rounded-full bg-amber-500"
                            title={`${day.weight.count} weight`}
                          />
                        ) : null}
                        {day.customMetrics.length > 0 ? (
                          <span
                            className="size-1.5 rounded-full bg-violet-500"
                            title="Custom metric"
                          />
                        ) : null}
                        {day.dailyNote ? (
                          <StickyNote
                            className="size-2.5 text-sky-600 dark:text-sky-400"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>

                      {day.totalLogs > 0 ? (
                        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {day.totalLogs}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right: Selected Date Stats & Real-Time Reminders */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {activeDay ? (
            <>
              {/* Day Header & Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {formatFullDateTitle(activeDay.date)}
                        </CardTitle>
                        {activeDay.isToday ? (
                          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            Today
                          </span>
                        ) : activeDay.isFuture ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                            Upcoming
                          </span>
                        ) : null}
                      </div>
                      <CardDescription className="mt-0.5">
                        {activeDay.totalLogs > 0
                          ? `${activeDay.totalLogs} reading${activeDay.totalLogs === 1 ? "" : "s"} logged`
                          : "No readings recorded on this date"}
                        {activeDay.scheduledCount > 0
                          ? ` · ${activeDay.completedScheduledCount}/${activeDay.scheduledCount} routine check-ins`
                          : ""}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => {
                          setRemTime(
                            getDefaultUpcomingTime(
                              activeDay.isToday,
                              data.timezone
                            )
                          );
                          setShowAddReminder((prev) => !prev);
                        }}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        Reminder
                      </Button>
                      <Link
                        href="/log"
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Log
                      </Link>
                    </div>
                  </div>
                </CardHeader>

                {/* Day Stats Grid */}
                <CardContent className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Glucose Day Stat */}
                    <div className="rounded-xl bg-muted/45 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <Droplets
                          className="size-3.5 text-emerald-600"
                          aria-hidden="true"
                        />
                        Glucose
                      </div>
                      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                        {activeDay.glucose.average !== null
                          ? `${activeDay.glucose.average} ${data.units.glucose}`
                          : "--"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {activeDay.glucose.count > 0
                          ? `${activeDay.glucose.count} logs · ${activeDay.glucose.min}–${activeDay.glucose.max}`
                          : "No readings"}
                      </p>
                      {activeDay.glucose.fastingAverage !== null ||
                      activeDay.glucose.postMealAverage !== null ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {activeDay.glucose.fastingAverage !== null
                            ? `Fasting ${activeDay.glucose.fastingAverage}`
                            : ""}
                          {activeDay.glucose.fastingAverage !== null &&
                          activeDay.glucose.postMealAverage !== null
                            ? " · "
                            : ""}
                          {activeDay.glucose.postMealAverage !== null
                            ? `Post-meal ${activeDay.glucose.postMealAverage}`
                            : ""}
                        </p>
                      ) : null}
                      {activeDay.glucose.outOfTargetCount > 0 ? (
                        <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          {activeDay.glucose.outOfTargetCount} above saved reference
                        </p>
                      ) : null}
                    </div>

                    {/* Blood Pressure Day Stat */}
                    <div className="rounded-xl bg-muted/45 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <HeartPulse
                          className="size-3.5 text-rose-600"
                          aria-hidden="true"
                        />
                        Blood Pressure
                      </div>
                      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                        {activeDay.bloodPressure.avgSystolic !== null &&
                        activeDay.bloodPressure.avgDiastolic !== null
                          ? `${activeDay.bloodPressure.avgSystolic}/${activeDay.bloodPressure.avgDiastolic}`
                          : "--"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {activeDay.bloodPressure.count > 0
                          ? `${activeDay.bloodPressure.count} logs · ${
                              activeDay.bloodPressure.avgPulse !== null
                                ? `Pulse ${activeDay.bloodPressure.avgPulse} bpm`
                                : "mmHg avg"
                            }`
                          : "No readings"}
                      </p>
                      {activeDay.bloodPressure.outOfTargetCount > 0 ? (
                        <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          {activeDay.bloodPressure.outOfTargetCount} above saved reference
                        </p>
                      ) : null}
                    </div>

                    {/* Weight Day Stat */}
                    <div className="rounded-xl bg-muted/45 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <Scale
                          className="size-3.5 text-amber-600"
                          aria-hidden="true"
                        />
                        Weight
                      </div>
                      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                        {activeDay.weight.latest !== null
                          ? `${activeDay.weight.latest} ${data.units.weight}`
                          : "--"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {activeDay.weight.changeFromPrevious !== null
                          ? `${activeDay.weight.changeFromPrevious > 0 ? "+" : ""}${activeDay.weight.changeFromPrevious} ${data.units.weight} vs prev`
                          : activeDay.weight.count > 0
                            ? `${activeDay.weight.count} recorded`
                            : "No reading"}
                      </p>
                    </div>

                    {/* Routine / Custom Day Stat */}
                    <div className="rounded-xl bg-muted/45 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <Activity
                          className="size-3.5 text-primary"
                          aria-hidden="true"
                        />
                        Day Completion
                      </div>
                      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                        {activeDay.scheduledCount > 0
                          ? `${Math.round((activeDay.completedScheduledCount / activeDay.scheduledCount) * 100)}%`
                          : activeDay.totalLogs > 0
                            ? `${activeDay.totalLogs} logged`
                            : "--"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {activeDay.scheduledCount > 0
                          ? `${activeDay.completedScheduledCount}/${activeDay.scheduledCount} routine check-ins`
                          : "No routine slots"}
                        {activeDay.customMetrics.length > 0
                          ? ` · ${activeDay.customMetrics.map((c) => `${c.label}: ${c.summaryValues[0]}`).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Inline Add Reminder Composer */}
              {showAddReminder ? (
                <Card className="ring-primary/35">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Schedule Real-Time Reminder
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Fires automatically at the exact time in {data.timezone}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createReminderMutation.mutate();
                      }}
                      className="flex flex-col gap-3"
                    >
                      {/* Quick presets */}
                      <div className="flex flex-wrap gap-1.5">
                        {REMINDER_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setRemCategory(preset.category);
                              setRemLabel(preset.label);
                              if (!activeDay.isToday) {
                                setRemTime(preset.defaultTime);
                              }
                            }}
                            className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/8"
                          >
                            + {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Scope toggle: this specific date vs recurring */}
                      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/50 p-1">
                        <button
                          type="button"
                          onClick={() => setRemMode("single_date")}
                          className={cn(
                            "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                            remMode === "single_date"
                              ? "bg-card text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Only {activeDay.date.slice(5)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemMode("recurring")}
                          className={cn(
                            "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                            remMode === "recurring"
                              ? "bg-card text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Repeat Weekly
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cal-rem-cat" className="text-xs">
                            Category
                          </Label>
                          <Select
                            value={remCategory}
                            onValueChange={(next) => {
                              if (next) setRemCategory(next as ReminderCategory);
                            }}
                          >
                            <SelectTrigger id="cal-rem-cat" className="h-9 w-full text-xs">
                              <SelectValue>
                                {(v: string | null) =>
                                  getReminderCategoryLabel(
                                    (v as ReminderCategory) || "glucose"
                                  )
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="glucose">Blood Glucose</SelectItem>
                              <SelectItem value="blood_pressure">
                                Blood Pressure
                              </SelectItem>
                              <SelectItem value="weight">Weight</SelectItem>
                              <SelectItem value="appointment">
                                OB / Care Appointment
                              </SelectItem>
                              <SelectItem value="medication">
                                Medication / Vitamin
                              </SelectItem>
                              <SelectItem value="custom">Custom Reminder</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cal-rem-time" className="text-xs">
                            Exact Time
                          </Label>
                          <Input
                            id="cal-rem-time"
                            type="time"
                            value={remTime}
                            onChange={(e) => setRemTime(e.target.value)}
                            className="h-9 text-xs"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cal-rem-label" className="text-xs">
                          Reminder Message
                        </Label>
                        <Input
                          id="cal-rem-label"
                          value={remLabel}
                          onChange={(e) => setRemLabel(e.target.value)}
                          placeholder="e.g. Check 1h post-breakfast glucose"
                          className="h-9 text-xs"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cal-rem-channel" className="text-xs">
                            Notify via
                          </Label>
                          <Select
                            value={remChannel}
                            onValueChange={(next) => {
                              if (next) setRemChannel(next as NotificationChannel);
                            }}
                          >
                            <SelectTrigger id="cal-rem-channel" className="h-9 w-full text-xs">
                              <SelectValue>
                                {(v: string | null) =>
                                  v === "push"
                                    ? "Web Push"
                                    : v === "email"
                                      ? "Email"
                                      : "Live In-App + Browser"
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in_app">
                                Live In-App + Browser
                              </SelectItem>
                              <SelectItem value="push">Web Push</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cal-rem-followup" className="text-xs">
                            Follow-up (mins)
                          </Label>
                          <Input
                            id="cal-rem-followup"
                            type="number"
                            min={5}
                            max={240}
                            value={remFollowUp}
                            onChange={(e) => setRemFollowUp(e.target.value)}
                            placeholder="Optional"
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      {remMode === "recurring" ? (
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Repeat Days</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {WEEKDAY_SHORT.map((lbl, idx) => {
                              const active = remDaysOfWeek.includes(idx);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => toggleRecurringWeekday(idx)}
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                                    active
                                      ? "bg-primary text-primary-foreground"
                                      : "border border-border bg-card text-muted-foreground"
                                  )}
                                >
                                  {lbl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => setShowAddReminder(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          disabled={
                            createReminderMutation.isPending || !remLabel.trim()
                          }
                        >
                          {createReminderMutation.isPending ? (
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Bell className="size-3.5" aria-hidden="true" />
                          )}
                          Save Reminder
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : null}

              {/* Reminders Scheduled on Selected Date */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Clock className="size-4 text-primary" aria-hidden="true" />
                      Reminders on This Day ({activeDay.reminders.length})
                    </CardTitle>
                    <button
                      type="button"
                      onClick={() => {
                        setRemTime(
                          getDefaultUpcomingTime(
                            activeDay.isToday,
                            data.timezone
                          )
                        );
                        setShowAddReminder(true);
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Set reminder
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {activeDay.reminders.length === 0 ? (
                    <p className="rounded-xl bg-muted/35 p-3 text-xs text-muted-foreground">
                      No reminders set for this date yet. Tap &ldquo;+ Set
                      reminder&rdquo; to schedule a check-in, prenatal vitamin, or
                      clinic appointment.
                    </p>
                  ) : (
                    activeDay.reminders.map((rem) => (
                      <div
                        key={rem.id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl border border-border/60 p-2.5",
                          !rem.enabled && "opacity-60"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground">
                              {rem.timeLabel}
                            </span>
                            <span className="truncate text-xs font-medium text-foreground">
                              · {rem.label}
                            </span>
                            {rem.isDateSpecific ? (
                              <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                This date
                              </span>
                            ) : null}
                            {rem.notificationStatus === "sent" ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="size-2.5" aria-hidden="true" />
                                Notified
                              </span>
                            ) : rem.notificationStatus === "snoozed" ? (
                              <span className="rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                Snoozed
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {getReminderCategoryLabel(rem.category)} ·{" "}
                            {rem.channel.replace("_", "-")}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={rem.enabled}
                            aria-label={`Toggle ${rem.label}`}
                            onCheckedChange={(checked) =>
                              toggleReminderMutation.mutate({
                                id: rem.id,
                                enabled: checked,
                              })
                            }
                          />
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            aria-label={`Delete ${rem.label}`}
                            onClick={() => deleteReminderMutation.mutate(rem.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Measurements & Routine Timeline for Selected Date */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Recorded Data ({activeDay.entries.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Chronological measurements and scheduled slots for this date.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {activeDay.entries.length === 0 ? (
                    <p className="rounded-xl bg-muted/35 p-3 text-xs text-muted-foreground">
                      No measurements recorded on {formatFullDateTitle(activeDay.date)}.
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60">
                      {activeDay.entries.map((entry) => (
                        <div
                          key={`${entry.metricType}-${entry.id}`}
                          className="flex items-start justify-between gap-3 px-3 py-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold tabular-nums text-foreground">
                                {entry.displayValue}
                              </span>
                              <span className="text-muted-foreground">
                                · {entry.metricLabel}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {entry.timeLabel} · {entry.contextLabel}
                              {entry.source === "voice" ? " · Voice" : ""}
                            </p>
                            {entry.notes ? (
                              <p className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-foreground">
                                {entry.notes}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDay.tasks.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Routine Slots ({activeDay.completedScheduledCount}/
                        {activeDay.scheduledCount})
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {activeDay.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-muted/35 px-2.5 py-1.5 text-[11px]"
                          >
                            <span className="truncate font-medium text-foreground">
                              {task.scheduledTime} · {task.measurementName} (
                              {task.context})
                            </span>
                            <StatusBadge status={task.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Daily Note Editor for Selected Date */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <StickyNote
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    Note for {activeDay.date}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  <Textarea
                    rows={3}
                    value={noteValue}
                    onChange={(e) =>
                      setNoteDraftMap((prev) => ({
                        ...prev,
                        [activeDay.date]: e.target.value,
                      }))
                    }
                    placeholder="Meals, sleep, movement, symptoms, or questions for your care visit..."
                    className="text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      disabled={saveNoteMutation.isPending}
                      onClick={() =>
                        saveNoteMutation.mutate({
                          date: activeDay.date,
                          content: noteValue,
                        })
                      }
                    >
                      {saveNoteMutation.isPending ? "Saving..." : "Save Note"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
