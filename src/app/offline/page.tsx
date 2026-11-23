"use client";

import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-md border-border/80 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <WifiOff className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">You&apos;re currently offline</CardTitle>
          <CardDescription>
            Tracx couldn&apos;t reach the server. To protect your privacy,
            personal health records are not cached in browser storage when you
            are away from the network.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            size="lg"
            type="button"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try Again
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/log" className="w-full">
              <Button variant="outline" size="lg" className="w-full">
                Quick Log
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full">
              <Button variant="outline" size="lg" className="w-full">
                Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
