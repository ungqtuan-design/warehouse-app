/** Format an instant for display only; never shift or rewrite the stored timestamp. */
export function formatLocalDateTime(iso: string, timeZone: string): string {
  // A timestamp without an offset is ambiguous and must not inherit the server zone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(iso)) return "—";
  const instant = new Date(iso);
  if (!Number.isFinite(instant.getTime())) return "—";
  try {
    const parts = new Intl.DateTimeFormat("vi-VN", {
      timeZone, day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}:${part("second")}`;
  } catch {
    return "—";
  }
}
