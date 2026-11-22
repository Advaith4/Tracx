import Link from "next/link";
import { HeartPulse, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <HeartPulse className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tracx</h1>
            <p className="text-xs font-medium text-muted-foreground">
              Personal Health Companion
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold leading-snug tracking-tight">
            Your personal health companion.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Track your daily measurements, stay consistent with reminders, and
            understand your health records in one place.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-secondary/50 p-4 text-xs text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <Mic className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Speak naturally or enter readings manually — designed for quick,
              low-effort daily tracking.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              Your health records are private to your account. Tracx is a
              tracking tool, not a replacement for professional medical advice.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/signup" className="block">
            <Button size="lg" className="w-full" type="button">
              Get Started
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button size="lg" variant="outline" className="w-full" type="button">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
