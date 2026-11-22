import Link from "next/link";
import { Bell, HeartPulse } from "lucide-react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-1 bg-background text-foreground">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 md:hidden"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <HeartPulse className="size-4" aria-hidden="true" />
              </div>
              <span className="text-base font-semibold tracking-tight">
                Tracx
              </span>
            </Link>

            <div className="hidden md:block">
              <p className="text-sm font-medium text-muted-foreground">
                Personal Health Tracking Companion
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-lg"
                type="button"
                aria-label="Notifications"
                title="Notifications (coming in Milestone 10)"
              >
                <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-10 md:pt-7">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
