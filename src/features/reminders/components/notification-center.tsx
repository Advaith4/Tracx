"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck, Clock, Plus, Trash2 } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface NotificationLogItem {
  id: string;
  reminder_id: string | null;
  scheduled_for: string;
  sent_at: string | null;
  read_at: string | null;
  channel: string;
  status: string;
  error_message: string | null;
  reminderLabel: string;
  metricType: string;
}

export function NotificationCenter({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["notifications", userId];

  const { data: items = [], isLoading, error, refetch } = useQuery<
    NotificationLogItem[]
  >({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't load notifications.");
      }
      return json.data;
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (body: {
      action: "mark_read" | "mark_all_read" | "clear_read" | "snooze";
      logId?: string;
      snoozeMinutes?: number;
    }) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Action failed.");
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey });
      if (variables.action === "snooze") {
        toast.info("Reminder snoozed for 15 minutes");
      } else if (variables.action === "clear_read") {
        toast.success("Cleared read notifications");
      }
    },
  });

  if (isLoading) return <LoadingState rows={3} />;
  if (error) {
    return (
      <ErrorState
        message="Couldn't load your notifications."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={items.length === 0 || actionMutation.isPending}
            onClick={() => actionMutation.mutate({ action: "mark_all_read" })}
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            Mark all read
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            disabled={items.length === 0 || actionMutation.isPending}
            onClick={() => actionMutation.mutate({ action: "clear_read" })}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Clear read
          </Button>
        </div>

        <Link href="/profile/reminders">
          <Button size="sm" variant="secondary" type="button">
            Reminder Settings
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="Due reminders and delivery history will appear here."
          action={
            <Link href="/profile/reminders">
              <Button size="lg" variant="outline" type="button">
                Configure Reminders
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const unread = !item.read_at;
            return (
              <Card
                key={item.id}
                size="sm"
                className={unread ? "ring-primary/40" : "opacity-80"}
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {item.reminderLabel}
                      </span>
                      {unread ? (
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          New
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.channel.replace("_", "-")} · {item.status} ·{" "}
                      {new Date(item.scheduled_for).toLocaleString()}
                    </span>
                    {item.error_message ? (
                      <span className="text-xs text-muted-foreground">
                        {item.error_message}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/log?metric=${item.metricType}`}>
                      <Button size="sm" variant="secondary" type="button">
                        <Plus className="size-3.5" aria-hidden="true" />
                        Log
                      </Button>
                    </Link>

                    {unread ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() =>
                            actionMutation.mutate({
                              action: "snooze",
                              logId: item.id,
                              snoozeMinutes: 15,
                            })
                          }
                        >
                          <Clock className="size-3.5" aria-hidden="true" />
                          Snooze
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() =>
                            actionMutation.mutate({
                              action: "mark_read",
                              logId: item.id,
                            })
                          }
                        >
                          Done
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
