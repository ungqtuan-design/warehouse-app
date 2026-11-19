// Date-only warehouse business dates use Vietnam time, not the browser timezone.
export function vietnamToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseOutboundDate(value: unknown, now = new Date()): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > vietnamToday(now)) return null;
  return date; // Prisma @db.Date stores the calendar date, not a local midnight instant.
}

export function formatOutboundDate(value: string | null): string {
  return value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Chưa xác nhận";
}
