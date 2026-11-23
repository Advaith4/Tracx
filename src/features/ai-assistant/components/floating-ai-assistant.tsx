"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AiAssistantPanel } from "./ai-assistant-panel";

export function FloatingAiAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/assistant" || pathname.startsWith("/assistant/")) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask AI Assistant"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 h-11 gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 md:right-6 md:bottom-6"
      >
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        <span>Ask AI</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border/80 px-5 py-4 pr-12">
            <SheetTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              Ask Tracx AI
            </SheetTitle>
            <SheetDescription className="text-xs">
              Data-only Q&amp;A across your saved readings. Not medical advice.
            </SheetDescription>

            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/log?mode=voice"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Mic className="size-3.5" aria-hidden="true" />
                Voice Log
              </Link>
              <Link
                href="/assistant"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Full view
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col p-5">
            <AiAssistantPanel compact />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
