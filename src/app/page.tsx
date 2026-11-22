import { CheckCircle2, HeartPulse, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HeartPulse className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Milestone 1
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Tracx Health Companion
            </h1>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons,
          and the modular project structure are initialized and ready for
          Milestone 2 (Design System).
        </p>

        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Environment initialized — no backend or auth connected yet.</span>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" type="button">
            <Mic className="size-4" aria-hidden="true" />
            Ready for Phase 1
          </Button>
        </div>
      </div>
    </main>
  );
}
