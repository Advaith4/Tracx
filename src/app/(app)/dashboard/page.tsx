import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { LoadingState } from "@/components/layout/feedback-states";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedDashboard() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const fallbackName = user.email?.split("@")[0] ?? null;

  return <DashboardView userName={profile?.display_name ?? fallbackName} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState rows={4} />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}
