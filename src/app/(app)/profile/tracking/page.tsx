import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/layout/feedback-states";
import { Button } from "@/components/ui/button";
import { TrackingConfigManager } from "@/features/tracking-config/components/tracking-config-manager";
import { ensureAndListTrackingConfigs } from "@/features/tracking-config/service";
import { createClient } from "@/lib/supabase/server";

async function TrackingConfigContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile/tracking");
  }

  const configs = await ensureAndListTrackingConfigs(supabase, user.id);

  return <TrackingConfigManager userId={user.id} initialConfigs={configs} />;
}

export default function TrackingConfigPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tracking Configuration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize what you track, units, meal contexts, and check-in times.
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
        <TrackingConfigContent />
      </Suspense>
    </div>
  );
}
