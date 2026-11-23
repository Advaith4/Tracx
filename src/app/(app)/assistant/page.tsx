import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/layout/feedback-states";
import { buttonVariants } from "@/components/ui/button";
import { AiAssistantPanel } from "@/features/ai-assistant/components/ai-assistant-panel";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedAssistant() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/assistant");
  }

  return <AiAssistantPanel />;
}

export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions about your stored measurements and daily schedule.
          </p>
        </div>

        <Link
          href="/dashboard"
          className={buttonVariants({ size: "lg", variant: "outline" })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Home
        </Link>
      </div>

      <Suspense fallback={<LoadingState rows={2} />}>
        <AuthenticatedAssistant />
      </Suspense>
    </div>
  );
}
