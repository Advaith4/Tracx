import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DesignSystemPreview } from "@/components/layout/design-system-preview";
import { Button } from "@/components/ui/button";

export default function DesignSystemPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Design System
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Interactive Milestone 2 primitives, status badges, and feedback
            states.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="lg" type="button">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Home
          </Button>
        </Link>
      </div>

      <DesignSystemPreview />
    </div>
  );
}
