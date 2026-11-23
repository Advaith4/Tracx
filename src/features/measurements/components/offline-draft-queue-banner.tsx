"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CloudUpload, Loader2, Trash2, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/components/pwa/pwa-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getOfflineDraftsServerSnapshot,
  readAllOfflineDrafts,
  removeOfflineDraft,
  subscribeOfflineDrafts,
  syncSingleDraft,
  type OfflineMeasurementDraft,
} from "@/lib/offline/draft-queue";

const METRIC_LABELS: Record<OfflineMeasurementDraft["metricType"], string> = {
  glucose: "Glucose",
  blood_pressure: "Blood Pressure",
  weight: "Weight",
  custom: "Custom",
};

interface OfflineDraftQueueBannerProps {
  userId: string;
  onSynced: () => void;
}

export function OfflineDraftQueueBanner({
  userId,
  onSynced,
}: OfflineDraftQueueBannerProps) {
  const isOnline = useOnlineStatus();
  const allDrafts = useSyncExternalStore(
    subscribeOfflineDrafts,
    readAllOfflineDrafts,
    getOfflineDraftsServerSnapshot
  );

  const userDrafts = useMemo(
    () => allDrafts.filter((draft) => draft.userId === userId),
    [allDrafts, userId]
  );

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (userDrafts.length === 0) {
    return null;
  }

  async function handleSyncAll() {
    if (!isOnline) {
      toast.info("Connect to the internet first to sync queued drafts.");
      return;
    }

    setIsSyncingAll(true);
    let syncedCount = 0;
    let conflictCount = 0;

    for (const draft of userDrafts) {
      const result = await syncSingleDraft(draft, false);
      if (result.ok) {
        syncedCount += 1;
      } else if (result.status === "duplicate_conflict") {
        conflictCount += 1;
      }
    }

    setIsSyncingAll(false);

    if (syncedCount > 0) {
      toast.success(
        `Synced ${syncedCount} queued ${syncedCount === 1 ? "reading" : "readings"}.`
      );
      onSynced();
    }
    if (conflictCount > 0) {
      toast.warning(
        `${conflictCount} queued ${conflictCount === 1 ? "reading needs" : "readings need"} duplicate review.`
      );
    }
  }

  async function handleSaveAnyway(draft: OfflineMeasurementDraft) {
    setBusyId(draft.id);
    const result = await syncSingleDraft(draft, true);
    setBusyId(null);

    if (result.ok) {
      toast.success("Queued reading saved.");
      onSynced();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Card className="border-amber-300/80 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/25">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {!isOnline ? (
                <WifiOff className="size-4 text-amber-700" aria-hidden="true" />
              ) : (
                <CloudUpload className="size-4 text-primary" aria-hidden="true" />
              )}
              Offline Measurement Drafts ({userDrafts.length})
            </CardTitle>
            <CardDescription>
              {isOnline
                ? "Your connection is back. Review and sync your queued drafts whenever you're ready."
                : "Saved on this device while offline. Drafts will stay here until you sync them online."}
            </CardDescription>
          </div>

          <Button
            size="sm"
            type="button"
            disabled={!isOnline || isSyncingAll}
            onClick={() => void handleSyncAll()}
          >
            {isSyncingAll ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Syncing...
              </>
            ) : (
              <>
                <CloudUpload className="size-4" aria-hidden="true" />
                Sync All
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {userDrafts.map((draft) => {
          const isBusy = busyId === draft.id;
          return (
            <div
              key={draft.id}
              className="flex flex-col gap-2 rounded-xl border border-border/80 bg-background/90 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {draft.summary}
                  </span>
                  <Badge variant="outline">
                    {METRIC_LABELS[draft.metricType]}
                  </Badge>
                  {draft.status === "duplicate_conflict" ? (
                    <Badge variant="secondary">Needs duplicate review</Badge>
                  ) : draft.status === "error" ? (
                    <Badge variant="destructive">Sync failed</Badge>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  Recorded {new Date(draft.measuredAt).toLocaleString()}
                </span>
                {draft.errorMessage ? (
                  <span className="text-xs text-destructive">
                    {draft.errorMessage}
                  </span>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {draft.status === "duplicate_conflict" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={!isOnline || isBusy}
                    onClick={() => void handleSaveAnyway(draft)}
                  >
                    {isBusy ? "Saving..." : "Save anyway"}
                  </Button>
                ) : null}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  type="button"
                  aria-label={`Discard ${draft.summary} draft`}
                  disabled={isBusy || isSyncingAll}
                  onClick={() => removeOfflineDraft(draft.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
