import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { getUiContext } from "@/lib/ui";
import { getDashboardData } from "@/lib/warehouse-data";

export default async function Home() {
  await requireUser();

  const [{ text }, { metrics, watchRows }] = await Promise.all([getUiContext(), getDashboardData({ includeImage: true })]);

  const riskClassNames = {
    red: "bg-rose-50 text-rose-700",
    yellow: "bg-amber-50 text-amber-700",
    normal: "bg-emerald-50 text-emerald-700",
  } as const;

  const riskLabels = {
    red: text.high,
    yellow: text.medium,
    normal: text.normal,
  } as const;

  const cards = [
    { label: text.totalProducts, value: metrics.totalProducts, note: text.dashboardBody },
    { label: text.lowStockItems, value: metrics.lowStockCount, note: text.monitorBody },
    { label: text.inbound30d, value: metrics.inboundCount30d, note: text.khoTong },
    { label: text.customerOrders30d, value: metrics.customerOrders30d, note: text.khoLe },
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">{text.dashboard}</p>
        <div className="mt-4">
          <div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {text.dashboardTitle}
            </h1>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/api/export/stock" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20">
                {text.exportStock}
              </Link>
              <Link href="/api/export/suppliers" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20">
                {text.exportSuppliers}
              </Link>
              <Link href="/api/export/orders" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20">
                {text.exportOrders}
              </Link>
              <Link href="/api/export/inventory" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20">
                {text.exportInventory}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatNumber(card.value)}</p>
            <p className="mt-2 text-sm text-slate-600">{card.note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.monitorTitle}</p>
            <h2 className="text-2xl font-semibold text-slate-950">{text.monitorBody}</h2>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {text.khoTong} / {text.khoLe}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1080px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{text.image}</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">{text.product}</th>
                <th className="px-4 py-3 font-medium">{text.supplier}</th>
                <th className="px-4 py-3 font-medium">{text.khoTong}</th>
                <th className="px-4 py-3 font-medium">{text.khoLe}</th>
                <th className="px-4 py-3 font-medium">{text.total}</th>
                <th className="px-4 py-3 font-medium">{text.outbound7d}</th>
                <th className="px-4 py-3 font-medium">{text.outbound30d}</th>
                <th className="px-4 py-3 font-medium">{text.leadTimeDays}</th>
                <th className="px-4 py-3 font-medium">{text.risk}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {watchRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.noInventoryRows}
                  </td>
                </tr>
              ) : watchRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt={row.name} className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
                    ) : (
                      <span className="text-xs text-slate-500">{text.noImage}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.sku}</td>
                  <td className="px-4 py-3 text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.supplierName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.khoTongQty)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.khoLeQty)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatNumber(row.totalQty)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.outbound7d)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.outbound30d)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.leadTimeDays)} {text.daySuffix}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskClassNames[row.riskLevel]}`}>
                      {riskLabels[row.riskLevel]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
