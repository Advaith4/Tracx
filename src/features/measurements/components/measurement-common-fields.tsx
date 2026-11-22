"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MeasurementDateTimeFieldsProps {
  idPrefix: string;
  dateValue: string;
  timeValue: string;
  notesValue: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}

export function MeasurementDateTimeFields({
  idPrefix,
  dateValue,
  timeValue,
  notesValue,
  onDateChange,
  onTimeChange,
  onNotesChange,
}: MeasurementDateTimeFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-11"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-time`}>Time</Label>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            value={timeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            className="h-11"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={notesValue}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add any helpful context (e.g. meal details, how you felt)"
          rows={2}
        />
      </div>
    </div>
  );
}

interface DuplicateConfirmDialogProps {
  open: boolean;
  message: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DuplicateConfirmDialog({
  open,
  message,
  isSubmitting,
  onCancel,
  onConfirm,
}: DuplicateConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Possible Duplicate Measurement</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={onConfirm}>
            Save Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
