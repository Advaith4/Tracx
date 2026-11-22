import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";

export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Measurement history, filters, and context-aware trends.
        </p>
      </div>
      <EmptyState
        icon={LineChart}
        title="History and charts coming in Milestone 8"
        description="Filterable glucose, blood pressure, and weight trends with deterministic statistics will appear here."
      />
    </div>
  );
}
