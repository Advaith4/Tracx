"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Droplets,
  Mic,
  Pencil,
  Scale,
  SlidersHorizontal,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UnifiedMeasurement } from "@/features/measurements/service";
import type {
  GlucoseUnit,
  MetricType,
  Tables,
  WeightUnit,
} from "@/types/database";
import { BloodPressureForm } from "./blood-pressure-form";
import { CustomMetricForm } from "./custom-metric-form";
import { GlucoseForm } from "./glucose-form";
import { WeightForm } from "./weight-form";

interface LogWorkspaceProps {
  userId: string;
  initialMetric: MetricType;
  contextHint?: string | null;
  configs: Tables<"tracking_configs">[];
  initialMeasurements: UnifiedMeasurement[];
}

async function fetchRecentMeasurements(): Promise<UnifiedMeasurement[]> {
  const response = await fetch("/api/measurements?limit=20");
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message ?? "Failed to load recent entries.");
  }
  return json.data;
}

function getDeleteEndpoint(item: UnifiedMeasurement): string {
  switch (item.metricType) {
    case "glucose":
      return `/api/measurements/glucose/${item.id}`;
    case "blood_pressure":
      return `/api/measurements/blood-pressure/${item.id}`;
    case "weight":
      return `/api/measurements/weight/${item.id}`;
    case "custom":
      return `/api/measurements/custom/${item.id}`;
  }
}

export function LogWorkspace({
  userId,
  initialMetric,
  contextHint,
  configs,
  initialMeasurements,
}: LogWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const customConfigs = configs.filter(
    (c) => c.metric_type === "custom" && c.enabled
  );

  const [activeMetric, setActiveMetric] = useState<MetricType>(
    initialMetric === "custom" && customConfigs.length === 0
      ? "glucose"
      : initialMetric
  );
  const [editingItem, setEditingItem] = useState<UnifiedMeasurement | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<UnifiedMeasurement | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const queryKey = ["measurements", userId, "recent"];
  const { data: measurements = initialMeasurements } = useQuery({
    queryKey,
    queryFn: fetchRecentMeasurements,
    initialData: initialMeasurements,
  });

  const glucoseUnit =
    (configs.find((c) => c.metric_type === "glucose")?.unit as GlucoseUnit) ??
    "mg/dL";
  const weightUnit =
    (configs.find((c) => c.metric_type === "weight")?.unit as WeightUnit) ??
    "kg";

  function handleSaved() {
    setEditingItem(null);
    void queryClient.invalidateQueries({ queryKey });
    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const response = await fetch(getDeleteEndpoint(deletingItem), {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't delete record.");
        return;
      }
      setDeletingItem(null);
      toast.success("Measurement deleted");
      void queryClient.invalidateQueries({ queryKey });
      router.refresh();
    } catch {
      toast.error("Couldn't delete record. Check your connection.");
    } finally {
      setIsDeleting(false);
    }
  }

  const metricTabs: Array<{
    type: MetricType;
    label: string;
    icon: typeof Droplets;
  }> = [
    { type: "glucose", label: "Glucose", icon: Droplets },
    { type: "blood_pressure", label: "Blood Pressure", icon: Activity },
    { type: "weight", label: "Weight", icon: Scale },
    ...(customConfigs.length > 0
      ? [{ type: "custom" as const, label: "Custom", icon: SlidersHorizontal }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <Mic className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Voice-assisted extraction arrives in Milestone 9. Manual &amp;
            backdated logging is always available here.
          </span>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Measurement type"
        className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
      >
        {metricTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeMetric === tab.type;
          return (
            <Button
              key={tab.type}
              role="tab"
              aria-selected={active}
              size="lg"
              variant={active ? "default" : "outline"}
              type="button"
              onClick={() => setActiveMetric(tab.type)}
              className="justify-center"
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeMetric === "glucose"
              ? "Record Blood Glucose"
              : activeMetric === "blood_pressure"
                ? "Record Blood Pressure"
                : activeMetric === "weight"
                  ? "Record Weight"
                  : "Record Custom Measurement"}
          </CardTitle>
          <CardDescription>
            You can adjust the date and time to log missed readings from earlier
            today or past days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeMetric === "glucose" ? (
            <GlucoseForm
              defaultUnit={glucoseUnit}
              contextHint={contextHint}
              onSaved={handleSaved}
            />
          ) : activeMetric === "blood_pressure" ? (
            <BloodPressureForm onSaved={handleSaved} />
          ) : activeMetric === "weight" ? (
            <WeightForm defaultUnit={weightUnit} onSaved={handleSaved} />
          ) : (
            <CustomMetricForm
              customConfigs={customConfigs}
              onSaved={handleSaved}
            />
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="recent-entries-heading" className="flex flex-col gap-3">
        <h2
          id="recent-entries-heading"
          className="text-sm font-medium text-muted-foreground"
        >
          Recent Entries
        </h2>

        {measurements.length === 0 ? (
          <EmptyState
            title="No measurements recorded yet"
            description="Save your first reading above and it will appear here and on your Home dashboard."
          />
        ) : (
          <Card size="sm">
            <CardContent className="divide-y divide-border p-0">
              {measurements.map((item) => (
                <div
                  key={`${item.metricType}-${item.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {item.displayValue}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.metricLabel}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.contextLabel} · {item.measuredAtLabel}
                    </span>
                    {item.notes ? (
                      <span className="truncate text-xs italic text-muted-foreground">
                        &ldquo;{item.notes}&rdquo;
                      </span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      type="button"
                      aria-label={`Edit ${item.metricLabel}`}
                      onClick={() => setEditingItem(item)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      type="button"
                      aria-label={`Delete ${item.metricLabel}`}
                      onClick={() => setDeletingItem(item)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editingItem?.metricLabel}</DialogTitle>
            <DialogDescription>
              Update the measurement value, context, date/time, or notes.
            </DialogDescription>
          </DialogHeader>

          {editingItem?.rawGlucose ? (
            <GlucoseForm
              initialRecord={editingItem.rawGlucose}
              onSaved={handleSaved}
            />
          ) : editingItem?.rawBloodPressure ? (
            <BloodPressureForm
              initialRecord={editingItem.rawBloodPressure}
              onSaved={handleSaved}
            />
          ) : editingItem?.rawWeight ? (
            <WeightForm
              initialRecord={editingItem.rawWeight}
              onSaved={handleSaved}
            />
          ) : editingItem?.rawCustom ? (
            <CustomMetricForm
              customConfigs={configs.filter((c) => c.metric_type === "custom")}
              initialRecord={editingItem.rawCustom}
              onSaved={handleSaved}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Measurement</DialogTitle>
            <DialogDescription>
              Remove {deletingItem?.metricLabel} ({deletingItem?.displayValue})
              recorded on {deletingItem?.measuredAtLabel}? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDeletingItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
