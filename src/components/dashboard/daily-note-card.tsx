"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface DailyNoteCardProps {
  todayDate: string;
  initialContent: string;
}

export function DailyNoteCard({
  todayDate,
  initialContent,
}: DailyNoteCardProps) {
  const router = useRouter();
  const [note, setNote] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/daily-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_date: todayDate,
          content: note.trim(),
        }),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't save daily note.");
        return;
      }
      toast.success(note.trim() ? "Daily note saved" : "Daily note cleared");
      router.refresh();
    } catch {
      toast.error("Couldn't save daily note. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-primary" aria-hidden="true" />
          <CardTitle>Daily Note</CardTitle>
        </div>
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
            disabled={saving || note.trim() === initialContent.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              "Save note"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
