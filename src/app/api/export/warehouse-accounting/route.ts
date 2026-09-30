import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getUiContext } from "@/lib/ui";
import { getWarehouseAccountingReport, type AccountingParams } from "@/lib/warehouse-accounting";

export async function GET(request: Request) {
  await requireUser();

  const searchParams = new URL(request.url).searchParams;
  // Preserve repeated parameters so the shared validator rejects ambiguous filters.
  const params: AccountingParams = Object.fromEntries([...new Set(searchParams.keys())].map((key) => {
    const values = searchParams.getAll(key);
    return [key, values.length === 1 ? values[0] : values];
  }));
  const [{ text }, report] = await Promise.all([getUiContext(), getWarehouseAccountingReport(params)]);
  if (!report.ok) {
    return NextResponse.json({ error: text[report.error] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const { filters } = report;
  const flows = {
    CUSTOMER_OUT: { label: text.accountingCustomerFlow, slug: "kho-le-khach" },
    TRANSFER: { label: text.accountingTransferFlow, slug: "kho-tong-kho-le" },
    MANUFACTURER_IN: { label: text.accountingSupplierFlow, slug: "ncc-kho-tong" },
  };
  const headers = [text.accountingReportType, text.accountingCsvFlow, text.accountingFrom, text.accountingTo,
    text.sku, text.product, text.quantity, text.accountingCurrentCost, text.accountingTotalValue];
  const rows = report.rows.map((row) => ({
    [text.accountingReportType]: filters.mode === "outbound" ? text.accountingOutbound : text.accountingInbound,
    [text.accountingCsvFlow]: flows[filters.flow].label,
    [text.accountingFrom]: filters.from,
    [text.accountingTo]: filters.to,
    [text.sku]: row.sku,
    [text.product]: row.name,
    [text.quantity]: row.quantity,
    [text.accountingCurrentCost]: row.costPrice,
    [text.accountingTotalValue]: row.value,
  }));
  const direction = filters.mode === "outbound" ? "xuat" : "nhap";
  const fileName = `ke-toan-kho_${direction}_${flows[filters.flow].slug}_${filters.from}_${filters.to}.csv`;

  return new NextResponse(toCsv(rows, headers), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
