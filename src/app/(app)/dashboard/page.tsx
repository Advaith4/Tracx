import Link from "next/link";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          App shell and 5-tab navigation are ready. Dashboard cards come next in
          Milestone 3.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Milestone 2 — Design System Active</CardTitle>
          <CardDescription>
            Calm warm-neutral palette, accessible status badges, responsive
            bottom nav and desktop sidebar, and reusable UI primitives are
            installed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/design-system">
            <Button size="lg" variant="secondary" type="button">
              <Palette className="size-4" aria-hidden="true" />
              Inspect Design System Components
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
