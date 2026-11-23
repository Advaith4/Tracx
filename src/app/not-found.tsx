import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-md border-border/80 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Page not found</CardTitle>
          <CardDescription>
            We couldn&apos;t find the page you were looking for.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href="/dashboard" className="w-full">
            <Button size="lg" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/" className="w-full">
            <Button variant="outline" size="lg" className="w-full">
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
