import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Bell, ChevronRight, SlidersHorizontal } from "lucide-react";
import { LoadingState } from "@/components/layout/feedback-states";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { createClient } from "@/lib/supabase/server";

async function ProfileContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <div className="flex flex-col gap-6 lg:col-span-5">
        <Card className="overflow-hidden border-border/80">
          <CardHeader>
            <CardTitle>Tracking &amp; Reminders</CardTitle>
            <CardDescription>
              Customize metrics, daily check-in schedules, and notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 border-t border-border/70 p-0">
            <Link
              href="/profile/tracking"
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    Metrics &amp; Schedules
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Units, meal contexts, custom metrics
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>

            <Link
              href="/profile/reminders"
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Bell className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    Reminders &amp; Alerts
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Push notifications, quiet hours, follow-ups
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>
              Sign out of your Tracx session on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-7">
        <ProfileSettingsForm
          userId={user.id}
          email={user.email ?? ""}
          initialProfile={profile}
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal details, timezone, and account session.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={3} />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
