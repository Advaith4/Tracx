"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Activity, Bell, Mic, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/layout/feedback-states";
import {
  StatusBadge,
  type MeasurementStatus,
} from "@/components/layout/status-badge";

const ALL_STATUSES: MeasurementStatus[] = [
  "recorded",
  "pending",
  "upcoming",
  "late",
  "skipped",
  "missed",
];

export function DesignSystemPreview() {
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [unit, setUnit] = useState<string | null>("mg/dL");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Status Indicators (Non-Color-Only)</CardTitle>
          <CardDescription>
            Every measurement status pairs a distinct icon, label, and calm
            pastel tint.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
          <Badge variant="secondary">Custom Metric</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buttons & Touch Targets</CardTitle>
          <CardDescription>
            Large touch targets (44px+) for comfortable one-handed mobile use.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button size="lg" type="button">
            <Mic className="size-4" aria-hidden="true" />
            Tap to Record
          </Button>
          <Button size="lg" variant="secondary" type="button">
            <Plus className="size-4" aria-hidden="true" />
            Add Measurement
          </Button>
          <Button
            size="lg"
            variant="outline"
            type="button"
            onClick={() =>
              toast.success("Measurement saved", {
                description: "Fasting glucose (92 mg/dL) recorded for today.",
              })
            }
          >
            <Bell className="size-4" aria-hidden="true" />
            Test Toast
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form Primitives</CardTitle>
          <CardDescription>
            Inputs, labels, selects, textareas, and switches for logging and
            settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="demo-glucose">Glucose reading</Label>
            <Input
              id="demo-glucose"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 94"
              className="h-11"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="demo-unit">Unit</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger id="demo-unit" className="h-11 w-full">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mg/dL">mg/dL</SelectItem>
                <SelectItem value="mmol/L">mmol/L</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="demo-notes">Optional notes</Label>
            <Textarea
              id="demo-notes"
              placeholder="Any context you'd like to remember..."
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3 sm:col-span-2">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="demo-reminders">Gentle check-in reminders</Label>
              <span className="text-xs text-muted-foreground">
                Lock-screen notifications keep health details private.
              </span>
            </div>
            <Switch
              id="demo-reminders"
              checked={remindersEnabled}
              onCheckedChange={setRemindersEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dialogs & Mobile Sheets</CardTitle>
          <CardDescription>
            Used for confirming AI-extracted readings, edits, and deletions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger render={<Button size="lg" variant="outline" />}>
              Open Confirmation Dialog
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Measurement</DialogTitle>
                <DialogDescription>
                  Review the extracted reading before saving it to your records.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl bg-muted p-3 text-sm">
                Blood Glucose: <strong>126 mg/dL</strong> (After Breakfast, 1h)
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <DialogClose
                  render={
                    <Button
                      onClick={() => toast.success("Confirmed in preview")}
                    />
                  }
                >
                  Confirm & Save
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger render={<Button size="lg" variant="secondary" />}>
              Open Bottom Sheet
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Quick Log Options</SheetTitle>
                <SheetDescription>
                  Choose voice capture or manual entry—manual logging is always
                  available.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <LoadingState rows={2} />
        <EmptyState
          icon={Activity}
          title="No measurements recorded yet"
          description="Tap the microphone or add a measurement manually whenever you're ready."
          action={
            <Button size="lg" type="button">
              Add First Reading
            </Button>
          }
        />
        <ErrorState
          message="Couldn't load your recent readings. Please check your connection and try again."
          onRetry={() => toast.info("Retry action triggered")}
        />
      </div>
    </div>
  );
}
