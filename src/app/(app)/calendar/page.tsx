import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import { CalendarWorkspace } from "@/features/calendar/components/calendar-workspace";
import { getCalendarMonthData } from "@/features/calendar/service";
import { createClient } from "@/lib/supabase/server";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function AuthenticatedCalendar({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ date?: string; month?: string }>;
}) {
  await connection();
  const [supabase, resolvedParams] = await Promise.all([
    createClient(),
    searchParamsPromise,
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/calendar");
  }

  const requestedDate =
    resolvedParams.date && ISO_DATE_REGEX.test(resolvedParams.date)
      ? resolvedParams.date
      : undefined;
  const requestedMonth =
    resolvedParams.month && /^\d{4}-\d{2}$/.test(resolvedParams.month)
      ? resolvedParams.month
      : requestedDate
        ? requestedDate.slice(0, 7)
        : undefined;

  const initialData = await getCalendarMonthData(supabase, user.id, {
    month: requestedMonth,
  });

  return (
    <CalendarWorkspace
      userId={user.id}
      initialData={initialData}
      initialSelectedDate={requestedDate}
    />
  );
}

export default function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Calendar &amp; Reminders
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Click any date to inspect that day&apos;s health stats and set real-time
          reminders.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={4} />}>
        <AuthenticatedCalendar searchParamsPromise={searchParams} />
      </Suspense>
    </div>
  );
}
