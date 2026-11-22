import { FileText } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly health summaries, PDF exports, and sharing.
        </p>
      </div>
      <EmptyState
        icon={FileText}
        title="Weekly reports coming in Milestone 11"
        description="Automated weekly summaries, completion tracking, and downloadable PDFs will be listed here."
      />
    </div>
  );
}
