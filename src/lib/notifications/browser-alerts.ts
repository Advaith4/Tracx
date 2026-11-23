"use client";

export type BrowserNotificationPermissionState =
  | NotificationPermission
  | "unsupported";

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showBrowserReminderNotification(params: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return false;
  }

  const targetUrl = params.url ?? "/calendar";

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        await reg.showNotification(params.title, {
          body: params.body,
          tag: params.tag,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          data: { url: targetUrl },
        });
        return true;
      }
    }
  } catch {
    // Fallback cleanly to window.Notification below.
  }

  try {
    const notification = new Notification(params.title, {
      body: params.body,
      tag: params.tag,
      icon: "/icons/icon-192.png",
    });
    notification.onclick = () => {
      window.focus();
      window.location.assign(targetUrl);
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function playGentleReminderChime(): void {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5 gentle two-note chime

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 900);
  } catch {
    // Autoplay audio before user gesture fails silently.
  }
}
