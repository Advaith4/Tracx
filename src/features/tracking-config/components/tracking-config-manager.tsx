"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { ErrorState } from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/types/database";
import type {
  CreateCustomMetricValues,
  UpdateTrackingConfigValues,
} from "../schemas";
import { MetricConfigCard } from "./metric-config-card";

interface TrackingConfigManagerProps {
  userId: string;
  initialConfigs: Tables<"tracking_configs">[];
}

async function fetchTrackingConfigs(): Promise<Tables<"tracking_configs">[]> {
  const response = await fetch("/api/tracking-config");
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message ?? "Failed to load tracking settings.");
  }
  return json.data;
}

export function TrackingConfigManager({
  userId,
  initialConfigs,
}: TrackingConfigManagerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["tracking-config", userId];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: configs = initialConfigs, error, refetch } = useQuery({
    queryKey,
    queryFn: fetchTrackingConfigs,
    initialData: initialConfigs,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: UpdateTrackingConfigValues) => {
      setSavingId(values.id);
      const response = await fetch("/api/tracking-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't save configuration.");
      }
      return json.data as Tables<"tracking_configs">;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      router.refresh();
      toast.success("Tracking configuration updated");
    },
    onError: (err: Error) => {
      toast.error("Couldn't save configuration", { description: err.message });
    },
    onSettled: () => setSavingId(null),
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateCustomMetricValues) => {
      const response = await fetch("/api/tracking-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't add custom metric.");
      }
      return json.data as Tables<"tracking_configs">;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      router.refresh();
      setDialogOpen(false);
      setNewName("");
      setNewUnit("");
      toast.success("Custom tracking category added");
    },
    onError: (err: Error) => {
      toast.error("Couldn't add custom metric", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id);
      const response = await fetch(`/api/tracking-config/${id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message ?? "Couldn't delete metric.");
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      router.refresh();
      toast.success("Custom metric removed");
    },
    onError: (err: Error) => {
      toast.error("Couldn't delete metric", { description: err.message });
    },
    onSettled: () => setDeletingId(null),
  });

  function handleCreateCustomMetric(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUnit.trim()) return;

    createMutation.mutate({
      custom_label: newName.trim(),
      unit: newUnit.trim(),
      show_on_dashboard: true,
      include_in_reports: true,
      schedule: {
        contexts: ["Daily"],
        slots: [
          {
            id: `custom-${Date.now()}`,
            context: "Daily",
            time: "09:00",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          },
        ],
      },
    });
  }

  if (error) {
    return (
      <ErrorState
        message="Couldn't load your tracking configurations."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Active categories and check-in times automatically update your Home
          dashboard.
        </p>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="lg" variant="secondary" type="button">
                <Plus className="size-4" aria-hidden="true" />
                Add Custom Metric
              </Button>
            }
          />
          <DialogContent>
            <form onSubmit={handleCreateCustomMetric} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Add Custom Tracking Category</DialogTitle>
                <DialogDescription>
                  Track an additional measurement or observation requested by
                  your healthcare provider.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-metric-name">Metric name</Label>
                <Input
                  id="custom-metric-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Water Intake, Temperature, Fetal Movement"
                  className="h-11"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-metric-unit">Unit</Label>
                <Input
                  id="custom-metric-unit"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="e.g. L, °C, kicks"
                  className="h-11"
                  required
                />
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !newName.trim() ||
                    !newUnit.trim()
                  }
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Adding...
                    </>
                  ) : (
                    "Add Metric"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-5">
        {configs.map((config) => (
          <MetricConfigCard
            key={`${config.id}-${config.updated_at}`}
            config={config}
            isSaving={savingId === config.id && updateMutation.isPending}
            isDeleting={deletingId === config.id && deleteMutation.isPending}
            onSave={(values) => updateMutation.mutate(values)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}
