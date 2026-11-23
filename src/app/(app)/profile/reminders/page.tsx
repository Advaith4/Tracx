import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
import { RemindersManager } from "@/features/reminders/components/reminders-manager";
import { createClient } from "@/lib/supabase/server";

async function RemindersContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile/reminders");
  }

  const [profileRes, remindersRes, subsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_time", { ascending: true }),
    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .limit(1),
  ]);

  return (
    <RemindersManager
      userId={user.id}
      timezone={profileRes.data?.timezone ?? "UTC"}
      initialReminders={remindersRes.data ?? []}
      hasPushSubscription={Boolean(subsRes.data && subsRes.data.length > 0)}
    />
  );
}

export default function RemindersPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage scheduled check-in reminders, channels, and quiet hours.
          </p>
        </div>

        <Link href="/profile">
          <Button size="lg" variant="outline" type="button">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Profile
          </Button>
        </Link>
      </div>

      <Suspense fallback={<LoadingState rows={3} />}>
        <RemindersContent />
      </Suspense>
    </div>
  );
}
