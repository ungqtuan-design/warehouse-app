import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AccountingParams = Record<string, string | string[] | undefined>;
export type AccountingMode = "outbound" | "inbound" | "returns";
// RETURNS is a report selection, not a database transaction type.
export type AccountingFlow = "CUSTOMER_OUT" | "TRANSFER" | "MANUFACTURER_IN" | "RETURNS";
export type AccountingReturnKind = "all" | "hoan" | "tra";
export type AccountingFilters = {
  mode: AccountingMode;
  flow: AccountingFlow;
  returnKind: AccountingReturnKind;
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
  const flow = params.flow ?? (mode === "returns" ? "RETURNS" : mode === "inbound" ? "MANUFACTURER_IN" : "CUSTOMER_OUT");
  const returnKind = params.returnKind ?? "all";
  if ((mode !== "outbound" && mode !== "inbound" && mode !== "returns") ||
      (flow !== "TRANSFER" && flow !== "CUSTOMER_OUT" && flow !== "MANUFACTURER_IN" && flow !== "RETURNS") ||
      ((mode === "returns") !== (flow === "RETURNS")) ||
      (mode === "outbound" && flow === "MANUFACTURER_IN") ||
      (mode === "inbound" && flow === "CUSTOMER_OUT") ||
      (returnKind !== "all" && returnKind !== "hoan" && returnKind !== "tra") ||
      (mode !== "returns" && params.returnKind !== undefined)) {
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
  return { ok: true, filters: { mode, flow, returnKind, from, to, start, endExclusive } };
}

const RETURN_NOTES = { hoan: "hàng hoàn", tra: "hàng trả" } as const;
const ADJUSTMENT_NOTE = "nhập điều chỉnh";
// Match String.trim() whitespace, including non-breaking spaces pasted from Excel.
const NOTE_WHITESPACE = " \t\n\r\f\v\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
type InboundAggregate = { productId: string; quantity: bigint; hoanQuantity: bigint; traQuantity: bigint };

async function getClassifiedInbound(filters: AccountingFilters) {
  const supplierOnly = filters.flow === "MANUFACTURER_IN";
  const returnNotes = filters.returnKind === "all" ? Object.values(RETURN_NOTES) : [RETURN_NOTES[filters.returnKind]];
  const noteFilter = supplierOnly
    ? Prisma.sql`"normalizedNote" NOT IN (${Prisma.join([...Object.values(RETURN_NOTES), ADJUSTMENT_NOTE])})`
    : Prisma.sql`"normalizedNote" IN (${Prisma.join(returnNotes)})`;

  // Classification and aggregation stay in Postgres. Only exact labels after
  // trimming whitespace and lowercasing match; other free text is not guessed.
  // Returns belong to the receipt period, regardless of the original sale date.
  return prisma.$queryRaw<InboundAggregate[]>(Prisma.sql`
    WITH classified AS (
      SELECT t."productId", t.quantity,
        lower(btrim(COALESCE(t.note, ''), ${NOTE_WHITESPACE})) AS "normalizedNote"
      FROM "InventoryTransaction" t
      JOIN "Location" destination ON destination.id = t."destinationLocationId"
      WHERE t.type = 'MANUFACTURER_IN' AND destination.code = 'KHO_TONG'
        AND t."createdAt" >= ${filters.start} AND t."createdAt" < ${filters.endExclusive}
        ${supplierOnly ? Prisma.sql`AND t."sourceLocationId" IS NULL` : Prisma.empty}
    )
    SELECT "productId", SUM(quantity) AS quantity,
      COALESCE(SUM(quantity) FILTER (WHERE "normalizedNote" = ${RETURN_NOTES.hoan}), 0) AS "hoanQuantity",
      COALESCE(SUM(quantity) FILTER (WHERE "normalizedNote" = ${RETURN_NOTES.tra}), 0) AS "traQuantity"
    FROM classified
    WHERE ${noteFilter}
    GROUP BY "productId"
  `);
}

export async function getWarehouseAccountingReport(params: AccountingParams, now = new Date()) {
  // Validate at the data boundary, including direct calls outside the page.
  const parsed = parseAccountingFilters(params, now);
  if (!parsed.ok) return parsed;
  const { filters } = parsed;
  const isNet = filters.flow === "CUSTOMER_OUT";
  const isReturns = filters.flow === "RETURNS";
  const [grouped, inbound] = await Promise.all([
    filters.flow === "TRANSFER" || isNet ? prisma.inventoryTransaction.groupBy({
      by: ["productId"],
      where: {
        type: isNet ? "CUSTOMER_OUT" : "TRANSFER",
        createdAt: { gte: filters.start, lt: filters.endExclusive },
        ...(isNet ? { sourceLocation: { code: "KHO_LE" }, destinationLocationId: null }
          : { sourceLocation: { code: "KHO_TONG" }, destinationLocation: { code: "KHO_LE" } }),
      },
      _sum: { quantity: true },
    }) : [],
    filters.flow === "TRANSFER" ? [] : getClassifiedInbound(filters),
  ]);
  const quantities = new Map(filters.flow === "MANUFACTURER_IN"
    ? inbound.map((row) => [row.productId, Number(row.quantity)])
    : grouped.map((row) => [row.productId, row._sum.quantity ?? 0]));
  const returns = new Map((isNet || isReturns ? inbound : []).map((row) => [row.productId, {
    hoan: Number(row.hoanQuantity), tra: Number(row.traQuantity),
  }]));
  const productIds = [...new Set([...quantities.keys(), ...returns.keys()])].filter((id) =>
    !isNet || (quantities.get(id) ?? 0) > 0 || (returns.get(id)?.hoan ?? 0) + (returns.get(id)?.tra ?? 0) > 0);
  const products = productIds.length === 0 ? [] : await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true, costPrice: true },
    orderBy: [{ sku: "asc" }],
  });
  let totalQuantity = 0;
  let totalValue = new Money(0);
  let totalGrossQuantity = 0;
  let totalReturnQuantity = 0;
  let totalGrossValue = new Money(0);
  let totalReturnValue = new Money(0);
  const rows = products.map((product) => {
    const grossQuantity = isNet ? quantities.get(product.id) ?? 0 : 0;
    const hoanQuantity = returns.get(product.id)?.hoan ?? 0;
    const traQuantity = returns.get(product.id)?.tra ?? 0;
    const returnQuantity = hoanQuantity + traQuantity;
    const netQuantity = grossQuantity - returnQuantity;
    const quantity = isNet ? netQuantity : isReturns ? returnQuantity : quantities.get(product.id) ?? 0;
    const cost = new Money(product.costPrice.toString());
    const grossValue = cost.mul(grossQuantity);
    const returnValue = cost.mul(returnQuantity);
    const netValue = grossValue.sub(returnValue);
    const value = isNet ? netValue : isReturns ? returnValue : cost.mul(quantity);
    totalQuantity += quantity;
    totalValue = totalValue.add(value);
    totalGrossQuantity += grossQuantity;
    totalReturnQuantity += returnQuantity;
    totalGrossValue = totalGrossValue.add(grossValue);
    totalReturnValue = totalReturnValue.add(returnValue);
    return { id: product.id, sku: product.sku, name: product.name, quantity,
      costPrice: cost.toFixed(2), value: value.toFixed(2),
      grossQuantity, hoanQuantity, traQuantity, returnQuantity, netQuantity,
      grossValue: grossValue.toFixed(2), returnValue: returnValue.toFixed(2), netValue: netValue.toFixed(2) };
  });
  return { ok: true as const, filters, rows, totalQuantity, totalValue: totalValue.toFixed(2),
    totalGrossQuantity, totalReturnQuantity, totalNetQuantity: totalGrossQuantity - totalReturnQuantity,
    totalGrossValue: totalGrossValue.toFixed(2), totalReturnValue: totalReturnValue.toFixed(2),
    totalNetValue: totalGrossValue.sub(totalReturnValue).toFixed(2) };
}

// Format exact decimal strings, without converting money to floating point.
export function formatAccountingMoney(value: string) {
  const sign = value.startsWith("-") ? "-" : "";
  const [whole, fraction = ""] = (sign ? value.slice(1) : value).split(".");
  const decimals = fraction.replace(/0+$/, "");
  return `${sign}${BigInt(whole).toLocaleString("vi-VN")}${decimals ? `,${decimals}` : ""} ₫`;
}
