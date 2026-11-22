import { User } from "lucide-react";
import { EmptyState } from "@/components/layout/feedback-states";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tracking configuration, reminders, privacy, and preferences.
        </p>
      </div>
      <EmptyState
        icon={User}
        title="Profile & tracking settings coming in Milestones 5 & 6"
        description="Configure metrics, meal contexts, schedules, units, reminders, and privacy preferences here."
      />
    </div>
  );
}
