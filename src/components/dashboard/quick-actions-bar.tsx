import Link from "next/link";
import { Mic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuickActionsBar() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Link href="/log?mode=voice" className="block">
        <Button size="lg" className="w-full justify-center shadow-xs" type="button">
          <Mic className="size-4" aria-hidden="true" />
          Tap to record a measurement
        </Button>
      </Link>

      <Link href="/log?mode=manual" className="block">
        <Button
          size="lg"
          variant="outline"
          className="w-full justify-center bg-card"
          type="button"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Measurement
        </Button>
      </Link>
    </div>
  );
}
