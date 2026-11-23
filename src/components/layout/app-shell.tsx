import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { HeaderNotificationBell } from "@/components/notifications/header-notification-bell";
import { LiveReminderMonitor } from "@/components/notifications/live-reminder-monitor";
import { FloatingAiAssistant } from "@/features/ai-assistant/components/floating-ai-assistant";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-1 bg-background text-foreground">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
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

            <div className="hidden items-center gap-2 md:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                Personal Health Companion
              </span>
            </div>

            <div className="flex items-center gap-2">
              <HeaderNotificationBell />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-7">
          {children}
        </main>
      </div>

      <LiveReminderMonitor />
      <FloatingAiAssistant />
      <BottomNav />
    </div>
  );
}
