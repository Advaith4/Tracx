import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import { LogbookWorkspace } from "@/features/logbook/components/logbook-workspace";
import { getLogbookData } from "@/features/logbook/service";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedLogbook() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/logbook");
  }

  const initialData = await getLogbookData(supabase, user.id, {
    preset: "30d",
  });

  return <LogbookWorkspace userId={user.id} initialData={initialData} />;
}

export default function LogbookPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Daily Logbook (Spreadsheet View)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review every day&apos;s readings side-by-side in an Excel-style sheet,
          edit any cell, or export to CSV.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={4} />}>
        <AuthenticatedLogbook />
      </Suspense>
    </div>
  );
}
