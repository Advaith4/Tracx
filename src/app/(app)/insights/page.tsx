import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import { InsightsWorkspace } from "@/features/insights/components/insights-workspace";
import { getInsightsData } from "@/features/insights/service";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedInsights() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/insights");
  }

  const initialData = await getInsightsData(supabase, user.id, {
    preset: "14d",
    glucoseContext: "all",
  });

  return <InsightsWorkspace userId={user.id} initialData={initialData} />;
}

export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review historical measurements, context-specific trends, and
          summaries.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={3} />}>
        <AuthenticatedInsights />
      </Suspense>
    </div>
  );
}
