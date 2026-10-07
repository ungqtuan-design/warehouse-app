export function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function maskSupplierName(name: string | null | undefined) {
  const value = name?.trim();
  return value ? `${Array.from(value).slice(0, 3).join("")}…` : name;
}
