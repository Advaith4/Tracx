export function toLocalDateInputValue(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalTimeInputValue(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function combineLocalDateTimeToIso(dateStr: string, timeStr: string): string {
  const combined = new Date(`${dateStr}T${timeStr || "00:00"}`);
  if (Number.isNaN(combined.getTime())) {
    return new Date().toISOString();
  }
  return combined.toISOString();
}
