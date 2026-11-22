"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
      <Link
        href="/dashboard"
        className="mb-8 flex items-center gap-3 px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <HeartPulse className="size-5" aria-hidden="true" />
        </div>
        <div>
          <span className="block text-base font-semibold tracking-tight text-sidebar-foreground">
            Tracx
          </span>
          <span className="block text-xs text-muted-foreground">
            Health Companion
          </span>
        </div>
      </Link>

      <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-1.5">
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
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        Personal tracking tool only — not a substitute for professional medical
        care.
      </div>
    </aside>
  );
}
