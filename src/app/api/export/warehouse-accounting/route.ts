import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { uiText as text } from "@/lib/ui";
import { getWarehouseAccountingReport, type AccountingParams } from "@/lib/warehouse-accounting";

export async function GET(request: Request) {
  await requireUser();

  const searchParams = new URL(request.url).searchParams;
  // Preserve repeated parameters so the shared validator rejects ambiguous filters.
  const params: AccountingParams = Object.fromEntries([...new Set(searchParams.keys())].map((key) => {
    const values = searchParams.getAll(key);
    return [key, values.length === 1 ? values[0] : values];
  }));
  const report = await getWarehouseAccountingReport(params);
  if (!report.ok) {
    return NextResponse.json({ error: text[report.error] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const { filters } = report;
  const isNet = filters.flow === "CUSTOMER_OUT";
  const isReturns = filters.flow === "RETURNS";
  const flows = {
    CUSTOMER_OUT: { label: text.accountingCustomerFlow, slug: "kho-le-khach" },
    TRANSFER: { label: text.accountingTransferFlow, slug: "kho-tong-kho-le" },
    MANUFACTURER_IN: { label: text.accountingSupplierFlow, slug: "ncc-kho-tong" },
  };
  const returnKinds = {
    all: { label: text.accountingReturnAll, slug: "tat-ca" },
    hoan: { label: text.accountingHoan, slug: "hang-hoan" },
    tra: { label: text.accountingTra, slug: "hang-tra" },
  };
  const selection = filters.flow === "RETURNS" ? returnKinds[filters.returnKind] : flows[filters.flow];
  const selectionHeader = isReturns ? text.accountingReturnKind : text.accountingCsvFlow;
  const quantityHeaders = isNet ? [text.accountingGrossQuantity, text.accountingReturnQuantity, text.accountingNetQuantity]
    : isReturns ? [text.accountingHoanQuantity, text.accountingTraQuantity, text.accountingTotalReturns] : [text.quantity];
  const valueHeaders = isNet ? [text.accountingGrossValue, text.accountingReturnValue, text.accountingNetValue]
    : isReturns ? [text.accountingReturnValue] : [text.accountingTotalValue];
  const headers = [text.accountingReportType, selectionHeader, text.accountingFrom, text.accountingTo,
    text.sku, text.product, ...quantityHeaders, text.accountingCurrentCost, ...valueHeaders];
  const rows = report.rows.map((row) => ({
    [text.accountingReportType]: isReturns ? text.accountingReturns : filters.mode === "outbound" ? text.accountingOutbound : text.accountingInbound,
    [selectionHeader]: selection.label,
    [text.accountingFrom]: filters.from,
    [text.accountingTo]: filters.to,
    [text.sku]: row.sku,
    [text.product]: row.name,
    ...(isNet ? {
      [text.accountingGrossQuantity]: row.grossQuantity,
      [text.accountingReturnQuantity]: row.returnQuantity,
      [text.accountingNetQuantity]: row.netQuantity,
    } : isReturns ? {
      [text.accountingHoanQuantity]: row.hoanQuantity,
      [text.accountingTraQuantity]: row.traQuantity,
      [text.accountingTotalReturns]: row.returnQuantity,
    } : { [text.quantity]: row.quantity }),
    [text.accountingCurrentCost]: row.costPrice,
    ...(isNet ? {
      [text.accountingGrossValue]: row.grossValue,
      [text.accountingReturnValue]: row.returnValue,
      [text.accountingNetValue]: row.netValue,
    } : isReturns ? { [text.accountingReturnValue]: row.returnValue } : { [text.accountingTotalValue]: row.value }),
  }));
  const direction = isReturns ? "hoan-tra" : isNet ? "xuat-rong" : filters.mode === "outbound" ? "xuat" : "nhap";
  const fileName = `ke-toan-kho_${direction}_${selection.slug}_${filters.from}_${filters.to}.csv`;

  return new NextResponse(toCsv(rows, headers), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
