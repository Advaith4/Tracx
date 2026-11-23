export type OfflineDraftMetricType =
  | "glucose"
  | "blood_pressure"
  | "weight"
  | "custom";

export type OfflineDraftStatus = "pending" | "duplicate_conflict" | "error";

export interface OfflineMeasurementDraft {
  id: string;
  userId: string;
  metricType: OfflineDraftMetricType;
  endpoint: string;
  summary: string;
  measuredAt: string;
  createdAt: string;
  payload: Record<string, unknown>;
  status: OfflineDraftStatus;
  errorMessage?: string;
}

const STORAGE_KEY = "tracx.offlineDrafts.v1";
const CHANGE_EVENT = "tracx-offline-drafts-changed";
const EMPTY_DRAFTS: OfflineMeasurementDraft[] = [];

let cachedRaw: string | null = null;
let cachedParsed: OfflineMeasurementDraft[] = EMPTY_DRAFTS;
let fallbackCounter = 0;

function generateDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `draft-${Date.now()}-${fallbackCounter}`;
}

export function isOfflineOrNetworkError(error?: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  return error instanceof TypeError;
}

export function parseOfflineDrafts(raw: string | null): OfflineMeasurementDraft[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OfflineMeasurementDraft =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.userId === "string" &&
        typeof item.endpoint === "string" &&
        typeof item.summary === "string" &&
        typeof item.payload === "object" &&
        item.payload !== null
    );
  } catch {
    return [];
  }
}

export function readAllOfflineDrafts(): OfflineMeasurementDraft[] {
  if (typeof window === "undefined") return EMPTY_DRAFTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedParsed;
    }
    cachedRaw = raw;
    const parsed = parseOfflineDrafts(raw);
    cachedParsed = parsed.length === 0 ? EMPTY_DRAFTS : parsed;
    return cachedParsed;
  } catch {
    return EMPTY_DRAFTS;
  }
}

function writeAllOfflineDrafts(drafts: OfflineMeasurementDraft[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(drafts);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedParsed = drafts.length === 0 ? EMPTY_DRAFTS : drafts;
  } catch {
    // Ignore quota or storage restriction failures cleanly
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function subscribeOfflineDrafts(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function getOfflineDraftsServerSnapshot(): OfflineMeasurementDraft[] {
  return EMPTY_DRAFTS;
}

export function enqueueMeasurementDraft(input: {
  userId: string;
  metricType: OfflineDraftMetricType;
  endpoint: string;
  summary: string;
  measuredAt: string;
  payload: Record<string, unknown>;
}): OfflineMeasurementDraft {
  const existing = readAllOfflineDrafts();
  const draft: OfflineMeasurementDraft = {
    id: generateDraftId(),
    userId: input.userId,
    metricType: input.metricType,
    endpoint: input.endpoint,
    summary: input.summary,
    measuredAt: input.measuredAt,
    createdAt: new Date().toISOString(),
    payload: input.payload,
    status: "pending",
  };
  writeAllOfflineDrafts([...existing, draft]);
  return draft;
}

export function updateOfflineDraftStatus(
  draftId: string,
  status: OfflineDraftStatus,
  errorMessage?: string
): void {
  const existing = readAllOfflineDrafts();
  const next = existing.map((item) =>
    item.id === draftId ? { ...item, status, errorMessage } : item
  );
  writeAllOfflineDrafts(next);
}

export function removeOfflineDraft(draftId: string): void {
  const existing = readAllOfflineDrafts();
  writeAllOfflineDrafts(existing.filter((item) => item.id !== draftId));
}

export function clearOfflineDraftsForUser(userId: string): void {
  const existing = readAllOfflineDrafts();
  writeAllOfflineDrafts(existing.filter((item) => item.userId !== userId));
}

export async function syncSingleDraft(
  draft: OfflineMeasurementDraft,
  allowDuplicate = false
): Promise<{ ok: true } | { ok: false; status: "duplicate_conflict" | "error"; message: string }> {
  try {
    const response = await fetch(draft.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft.payload, allowDuplicate }),
    });
    const json = await response.json();

    if (response.status === 409 && json.error?.code === "POTENTIAL_DUPLICATE") {
      const msg =
        json.error.message ??
        "A similar reading already exists near this timestamp.";
      updateOfflineDraftStatus(draft.id, "duplicate_conflict", msg);
      return { ok: false, status: "duplicate_conflict", message: msg };
    }

    if (!response.ok || json.error) {
      const msg = json.error?.message ?? "Couldn't sync queued draft.";
      updateOfflineDraftStatus(draft.id, "error", msg);
      return { ok: false, status: "error", message: msg };
    }

    removeOfflineDraft(draft.id);
    return { ok: true };
  } catch {
    const msg = "Still offline or server unreachable.";
    updateOfflineDraftStatus(draft.id, "error", msg);
    return { ok: false, status: "error", message: msg };
  }
}
