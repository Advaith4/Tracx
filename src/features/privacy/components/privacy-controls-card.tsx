"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearOfflineDraftsForUser } from "@/lib/offline/draft-queue";
import { createClient } from "@/lib/supabase/client";

interface PrivacyControlsCardProps {
  userId: string;
  email: string;
}

export function PrivacyControlsCard({ userId, email }: PrivacyControlsCardProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleExportData() {
    setIsExporting(true);
    try {
      const response = await fetch("/api/privacy/export", { method: "GET" });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        toast.error(json?.error?.message ?? "Couldn't export your records.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const dateStamp = new Date().toISOString().slice(0, 10);
      anchor.download = `tracx-health-export-${dateStamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Downloaded your personal health data export.");
    } catch {
      toast.error("Couldn't download export. Check your connection.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (confirmationText.trim() !== "DELETE") {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/privacy/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const json = await response.json();

      if (!response.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't delete your account.");
        return;
      }

      clearOfflineDraftsForUser(userId);
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => undefined);
      setDeleteDialogOpen(false);
      toast.success("Your account and health records have been deleted.");
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Couldn't complete account deletion. Check your connection.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Data &amp; Privacy Controls</CardTitle>
          <CardDescription>
            Download a full copy of your health records at any time, or
            permanently remove your account and stored data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                Export Personal Health Data
              </span>
              <span className="text-xs text-muted-foreground">
                Downloads a JSON archive containing your profile, tracking
                settings, measurements, daily notes, reminders, and weekly
                reports.
              </span>
            </div>
            <Button
              variant="outline"
              size="lg"
              type="button"
              disabled={isExporting}
              onClick={() => void handleExportData()}
              className="shrink-0"
            >
              {isExporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Preparing...
                </>
              ) : (
                <>
                  <Download className="size-4" aria-hidden="true" />
                  Export JSON
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-destructive">
                Delete Account &amp; All Data
              </span>
              <span className="text-xs text-muted-foreground">
                Permanently deletes {email} and all associated health records.
                This cannot be undone.
              </span>
            </div>
            <Button
              variant="destructive"
              size="lg"
              type="button"
              onClick={() => {
                setConfirmationText("");
                setDeleteDialogOpen(true);
              }}
              className="shrink-0"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setDeleteDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" aria-hidden="true" />
              Permanently Delete Account
            </DialogTitle>
            <DialogDescription>
              This immediately and permanently deletes your Tracx account,
              measurements, daily notes, reminders, and weekly reports. Consider
              exporting your data first if you want a personal copy.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="delete-confirmation-input">
              Type <span className="font-mono font-semibold">DELETE</span> to
              confirm
            </Label>
            <Input
              id="delete-confirmation-input"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="h-11 font-mono"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={confirmationText.trim() !== "DELETE" || isDeleting}
              onClick={() => void handleDeleteAccount()}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                "Permanently Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
