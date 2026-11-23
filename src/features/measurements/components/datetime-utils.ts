export function toLocalDateInputValue(
  isoString?: string,
  timezone?: string
): string {
  const date = isoString ? new Date(isoString) : new Date();
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      const year = parts.find((p) => p.type === "year")?.value ?? "1970";
      const month = parts.find((p) => p.type === "month")?.value ?? "01";
      const day = parts.find((p) => p.type === "day")?.value ?? "01";
      return `${year}-${month}-${day}`;
    } catch {
      // Fallback to local clock if invalid timezone
    }
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalTimeInputValue(
  isoString?: string,
  timezone?: string
): string {
  const date = isoString ? new Date(isoString) : new Date();
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const rawHour = parts.find((p) => p.type === "hour")?.value ?? "00";
      const hour = rawHour === "24" ? "00" : rawHour;
      const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
      return `${hour}:${minute}`;
    } catch {
      // Fallback to local clock if invalid timezone
    }
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatReportTimestamp(
  isoString: string,
  timezone = "UTC",
  includeTime = true
): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const tz = timezone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    }).format(date);
  }
}

export function combineLocalDateTimeToIso(
  dateStr: string,
  timeStr: string
): string {
  const combined = new Date(`${dateStr}T${timeStr || "00:00"}`);
  if (Number.isNaN(combined.getTime())) {
    return new Date().toISOString();
  }
  return combined.toISOString();
}
