import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AccountingParams = Record<string, string | string[] | undefined>;
export type AccountingMode = "outbound" | "inbound";
export type AccountingFlow = "CUSTOMER_OUT" | "TRANSFER" | "MANUFACTURER_IN";
export type AccountingFilters = {
  mode: AccountingMode;
  flow: AccountingFlow;
  from: string;
  to: string;
  start: Date;
  endExclusive: Date;
};

const DAY_MS = 86_400_000;
// Warehouse accounting uses Vietnam business dates (Asia/Ho_Chi_Minh,
// UTC+07 without DST), independent of the host or browser timezone.
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
// Keep sufficient precision for Decimal(14,2) costs multiplied by summed quantities.
const Money = Prisma.Decimal.clone({ precision: 40 });

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function vietnamDateString(date: Date) {
  return new Date(date.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

export function parseAccountingFilters(params: AccountingParams, now = new Date()):
  | { ok: true; filters: AccountingFilters }
  | { ok: false; error: "accountingInvalidParameters" | "accountingInvalidDate" | "accountingDateOrder" | "accountingDateLimit" } {
  if (Object.values(params).some((value) => value !== undefined && typeof value !== "string")) {
    return { ok: false, error: "accountingInvalidParameters" };
  }
  const mode = params.mode ?? "outbound";
  const flow = params.flow ?? (mode === "inbound" ? "MANUFACTURER_IN" : "CUSTOMER_OUT");
  if ((mode !== "outbound" && mode !== "inbound") ||
      (flow !== "TRANSFER" && flow !== "CUSTOMER_OUT" && flow !== "MANUFACTURER_IN") ||
      (mode === "outbound" && flow === "MANUFACTURER_IN") ||
      (mode === "inbound" && flow === "CUSTOMER_OUT")) {
    return { ok: false, error: "accountingInvalidParameters" };
  }
  const today = vietnamDateString(now);
  const from = params.from ?? `${today.slice(0, 7)}-01`;
  const to = params.to ?? today;
  if (typeof from !== "string" || typeof to !== "string") return { ok: false, error: "accountingInvalidParameters" };
  const first = calendarDate(from);
  const last = calendarDate(to);
  if (!first || !last) return { ok: false, error: "accountingInvalidDate" };
  const days = (last.getTime() - first.getTime()) / DAY_MS + 1;
  if (days < 1) return { ok: false, error: "accountingDateOrder" };
  if (days > 60) return { ok: false, error: "accountingDateLimit" };

  // first/last represent calendar dates at UTC midnight for validation above.
  // Subtract seven hours to query from Vietnam midnight, including the entire
  // final business date via an exclusive next-day boundary.
  const start = new Date(first.getTime() - VIETNAM_OFFSET_MS);
  const endExclusive = new Date(last.getTime() + DAY_MS - VIETNAM_OFFSET_MS);
  return { ok: true, filters: { mode, flow, from, to, start, endExclusive } };
}

export async function getWarehouseAccountingReport(params: AccountingParams, now = new Date()) {
  // Validate at the data boundary, including direct calls outside the page.
  const parsed = parseAccountingFilters(params, now);
  if (!parsed.ok) return parsed;
  const { filters } = parsed;
  const locationWhere: Prisma.InventoryTransactionWhereInput = filters.flow === "TRANSFER"
    ? { sourceLocation: { code: "KHO_TONG" }, destinationLocation: { code: "KHO_LE" } }
    : filters.flow === "CUSTOMER_OUT"
      ? { sourceLocation: { code: "KHO_LE" }, destinationLocationId: null }
      : { sourceLocationId: null, destinationLocation: { code: "KHO_TONG" } };
  const grouped = await prisma.inventoryTransaction.groupBy({
    by: ["productId"],
    where: {
      type: filters.flow,
      createdAt: { gte: filters.start, lt: filters.endExclusive },
      ...locationWhere,
    },
    _sum: { quantity: true },
  });
  const products = grouped.length === 0 ? [] : await prisma.product.findMany({
    where: { id: { in: grouped.map((row) => row.productId) } },
    select: { id: true, sku: true, name: true, costPrice: true },
    orderBy: [{ sku: "asc" }],
  });
  const quantities = new Map(grouped.map((row) => [row.productId, row._sum.quantity ?? 0]));
  let totalQuantity = 0;
  let totalValue = new Money(0);
  const rows = products.map((product) => {
    const quantity = quantities.get(product.id) ?? 0;
    const cost = new Money(product.costPrice.toString());
    const value = cost.mul(quantity);
    totalQuantity += quantity;
    totalValue = totalValue.add(value);
    return { id: product.id, sku: product.sku, name: product.name, quantity,
      costPrice: cost.toFixed(2), value: value.toFixed(2) };
  });
  return { ok: true as const, filters, rows, totalQuantity, totalValue: totalValue.toFixed(2) };
}

// Format exact decimal strings, without converting money to floating point.
export function formatAccountingMoney(value: string, language: "vi" | "en") {
  const [whole, fraction = ""] = value.split(".");
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const decimals = fraction.replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString(locale)}${decimals ? `${language === "vi" ? "," : "."}${decimals}` : ""} ₫`;
}
