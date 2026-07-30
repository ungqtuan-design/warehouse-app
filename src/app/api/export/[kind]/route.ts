import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getInventoryExportRows, getOrderExportRows, getStockExportRows, getSupplierExportRows } from "@/lib/warehouse-data";

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  await requireUser();

  const { kind } = await context.params;

  const exporters = {
    stock: {
      fileName: "stock-export.csv",
      getRows: getStockExportRows,
    },
    suppliers: {
      fileName: "supplier-export.csv",
      getRows: getSupplierExportRows,
    },
    orders: {
      fileName: "order-export.csv",
      getRows: getOrderExportRows,
    },
    inventory: {
      fileName: "inventory-monitor-export.csv",
      getRows: getInventoryExportRows,
    },
  } as const;

  const exportConfig = exporters[kind as keyof typeof exporters];

  if (!exportConfig) {
    return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
  }

  const rows = await exportConfig.getRows();
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportConfig.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
