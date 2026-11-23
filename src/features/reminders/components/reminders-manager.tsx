"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
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
import { formatTime12h } from "@/features/tracking-config/schedule-utils";
import type { NotificationChannel, Tables } from "@/types/database";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const emptySubscribe = () => () => {};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface RemindersManagerProps {
  userId: string;
  timezone: string;
  initialReminders: Tables<"reminders">[];
  hasPushSubscription: boolean;
}

export function RemindersManager({
  userId,
  timezone,
  initialReminders,
  hasPushSubscription,
}: RemindersManagerProps) {
  const queryClient = useQueryClient();
  const queryKey = ["reminders", userId];

  const pushSupported = useSyncExternalStore(
    emptySubscribe,
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
    () => false
  );

  const [pushSubscribed, setPushSubscribed] = useState(hasPushSubscription);
  const [subscribingPush, setSubscribingPush] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const [metricType, setMetricType] = useState<
    "glucose" | "blood_pressure" | "weight" | "custom"
  >("glucose");
  const [label, setLabel] = useState("");
  const [scheduledTime, setScheduledTime] = useState("08:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [channel, setChannel] = useState<NotificationChannel>("in_app");
  const [followUpMinutes, setFollowUpMinutes] = useState("30");
  const [snoozeMinutes, setSnoozeMinutes] = useState("15");
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");

  const { data: reminders = initialReminders } = useQuery<Tables<"reminders">[]>({
    queryKey,
    initialData: initialReminders,
    queryFn: async () => {
      const res = await fetch("/api/reminders");
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Failed to load reminders.");
      }
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_type: metricType,
          label: label.trim(),
          scheduled_time: scheduledTime,
          timezone,
          days_of_week: daysOfWeek,
          channel,
          enabled: true,
          follow_up_minutes: followUpMinutes.trim()
            ? Number(followUpMinutes)
            : null,
          snooze_minutes: Number(snoozeMinutes) || 15,
          quiet_hours_start: quietStart.trim() || null,
          quiet_hours_end: quietEnd.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't create reminder.");
      }
      return json.data as Tables<"reminders">;
    },
    onSuccess: () => {
      setLabel("");
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Reminder created");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const toggleMutation = useMutation({
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
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't delete reminder.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Reminder removed");
    },
  });

  async function handleEnablePush() {
    if (!pushSupported) {
      toast.error("Push notifications are not supported in this browser.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      toast.info(
        "VAPID public key is not set yet. In-app reminders still work without it."
      );
      return;
    }

    setSubscribingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(
          "Notification permission was denied. You can re-enable it in browser settings anytime."
        );
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const raw = subscription.toJSON();
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: raw.endpoint,
          keys: raw.keys,
          device_label: navigator.userAgent.slice(0, 60),
        }),
      });
      if (!res.ok) {
        throw new Error("Couldn't save browser subscription.");
      }

      setPushSubscribed(true);
      toast.success("Push notifications enabled for this device");
    } catch {
      toast.error("Couldn't enable push notifications on this device.");
    } finally {
      setSubscribingPush(false);
    }
  }

  async function handleDisablePush() {
    setSubscribingPush(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await registration?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) {
        await sub.unsubscribe();
      }

      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      setPushSubscribed(false);
      toast.success("Push notifications disabled on this device");
    } catch {
      toast.error("Couldn't disable push notifications.");
    } finally {
      setSubscribingPush(false);
    }
  }

  async function handleDispatchNow() {
    setDispatching(true);
    try {
      const res = await fetch("/api/notifications/dispatch", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error("Couldn't check due reminders.");
        return;
      }
      const count = json.data?.dispatched?.length ?? 0;
      toast.success(
        count > 0
          ? `Processed ${count} due reminder(s). Open Notifications to view.`
          : "No reminders are due right now."
      );
    } finally {
      setDispatching(false);
    }
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        return prev.length === 1 ? prev : prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Browser Push &amp; Privacy</CardTitle>
          <CardDescription>
            Lock-screen notifications say only &ldquo;Your scheduled health
            check-in is due&rdquo; to protect your privacy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {pushSubscribed ? (
            <Button
              size="lg"
              variant="outline"
              type="button"
              disabled={subscribingPush}
              onClick={() => void handleDisablePush()}
            >
              <BellOff className="size-4" aria-hidden="true" />
              Disable Browser Push
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              type="button"
              disabled={subscribingPush}
              onClick={() => void handleEnablePush()}
            >
              <Bell className="size-4" aria-hidden="true" />
              Enable Browser Push
            </Button>
          )}

          <Button
            size="lg"
            variant="outline"
            type="button"
            disabled={dispatching}
            onClick={() => void handleDispatchNow()}
          >
            {dispatching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            Check Due Reminders Now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Reminder</CardTitle>
          <CardDescription>
            Reminders automatically stop once you record that measurement for the
            day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-metric">Metric</Label>
                <Select
                  value={metricType}
                  onValueChange={(next) => {
                    if (next) {
                      setMetricType(
                        next as "glucose" | "blood_pressure" | "weight" | "custom"
                      );
                    }
                  }}
                >
                  <SelectTrigger id="rem-metric" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="glucose">Blood Glucose</SelectItem>
                    <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                    <SelectItem value="weight">Weight</SelectItem>
                    <SelectItem value="custom">Custom Metric</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-label">Label</Label>
                <Input
                  id="rem-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Morning check-in"
                  className="h-11"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-time">Time ({timezone})</Label>
                <Input
                  id="rem-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-channel">Channel</Label>
                <Select
                  value={channel}
                  onValueChange={(next) => {
                    if (next) setChannel(next as NotificationChannel);
                  }}
                >
                  <SelectTrigger id="rem-channel" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app">In-app</SelectItem>
                    <SelectItem value="push">Push notification</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-followup">
                  Follow-up delay (optional mins)
                </Label>
                <Input
                  id="rem-followup"
                  type="number"
                  min={5}
                  max={240}
                  value={followUpMinutes}
                  onChange={(e) => setFollowUpMinutes(e.target.value)}
                  placeholder="e.g. 30"
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-snooze">Snooze duration (mins)</Label>
                <Input
                  id="rem-snooze"
                  type="number"
                  min={5}
                  max={120}
                  value={snoozeMinutes}
                  onChange={(e) => setSnoozeMinutes(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-quiet-start">Quiet hours start</Label>
                <Input
                  id="rem-quiet-start"
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rem-quiet-end">Quiet hours end</Label>
                <Input
                  id="rem-quiet-end"
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Days of week</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((dayLabel, idx) => {
                  const selected = daysOfWeek.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      aria-pressed={selected}
                      className={`flex size-9 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {dayLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              size="lg"
              type="submit"
              disabled={createMutation.isPending || !label.trim()}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  Add Reminder
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="saved-reminders-heading" className="flex flex-col gap-3">
        <h2
          id="saved-reminders-heading"
          className="text-sm font-medium text-muted-foreground"
        >
          Configured Reminders ({reminders.length})
        </h2>

        {reminders.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No reminders configured yet"
            description="Create a gentle reminder above for your daily glucose, blood pressure, or weight check-ins."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {reminders.map((rem) => (
              <Card key={rem.id} size="sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {rem.label}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        {rem.channel.replace("_", "-")}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime12h(rem.scheduled_time.slice(0, 5))} ·{" "}
                      {rem.metric_type.replace("_", " ")}
                      {rem.follow_up_minutes
                        ? ` · Follow-up +${rem.follow_up_minutes}m`
                        : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rem.enabled}
                      aria-label={`Toggle ${rem.label}`}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: rem.id, enabled: checked })
                      }
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      type="button"
                      aria-label={`Delete ${rem.label}`}
                      onClick={() => deleteMutation.mutate(rem.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
