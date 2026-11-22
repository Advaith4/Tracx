"use client";

import { useState } from "react";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function DailyNoteCard() {
  const [note, setNote] = useState("");

  function handleSavePreview() {
    toast.success("Daily note preview saved", {
      description: "Notes will persist to Supabase starting in Milestone 4–7.",
    });
  }

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-primary" aria-hidden="true" />
          <CardTitle>Daily Note</CardTitle>
        </div>
        <CardDescription>
          Optional note about how you felt today, meals, or reminders for your
          provider.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Felt well rested this morning; took breakfast reading 1 hour after oats."
          aria-label="Daily note"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            disabled={!note.trim()}
            onClick={handleSavePreview}
          >
            Save note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
