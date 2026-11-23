import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import { NotificationCenter } from "@/features/reminders/components/notification-center";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedNotifications() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/notifications");
  }

  return <NotificationCenter userId={user.id} />;
}

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scheduled check-in reminders and delivery status.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={3} />}>
        <AuthenticatedNotifications />
      </Suspense>
    </div>
  );
}
