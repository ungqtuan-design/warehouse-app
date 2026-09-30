const BOM = "\uFEFF";

function escapeCell(raw: unknown) {
  const value = raw == null ? "" : String(raw);
  const escaped = value.replaceAll('"', '""');

  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

// Explicit headers keep the schema available even when a report has no rows.
export function toCsv(rows: Array<Record<string, unknown>>, headers: readonly string[] = Object.keys(rows[0] ?? {})) {
  if (headers.length === 0) return BOM;
  const lines = [headers.map(escapeCell).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(","));
  }

  return BOM + lines.join("\n");
}
