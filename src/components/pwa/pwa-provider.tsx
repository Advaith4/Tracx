"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeOnlineStatus(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
}

export function PwaProvider() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .catch(() => {
        // Non-blocking: browsers without SW support or strict modes degrade cleanly
      });
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-100"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        You&apos;re offline. New readings entered on Quick Log can be queued as
        drafts until your connection returns.
      </span>
    </div>
  );
}
