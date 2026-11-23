"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar/95 px-3.5 py-5 md:flex">
      <Link
        href="/dashboard"
        className="mb-7 flex items-center gap-3 rounded-xl px-2.5 py-1.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <HeartPulse className="size-5" aria-hidden="true" />
        </div>
        <div>
          <span className="block text-base font-semibold tracking-tight text-sidebar-foreground">
            Tracx
          </span>
          <span className="block text-[11px] text-muted-foreground">
            Health Companion
          </span>
        </div>
      </Link>

      <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-2xs ring-1 ring-primary/15"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-xl border border-border/70 bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        Personal tracking tool only — not a substitute for professional medical
        care.
      </div>
    </aside>
  );
}
