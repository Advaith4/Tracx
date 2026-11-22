import { Mic } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";

export default function LogPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Voice-first and manual measurement logging.
        </p>
      </div>
      <EmptyState
        icon={Mic}
        title="Measurement logging coming in Milestones 7 & 9"
        description="Manual forms for glucose, blood pressure, and weight will live here, followed by voice and AI-assisted extraction."
      />
    </div>
  );
}
