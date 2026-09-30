import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { getUiContext } from "@/lib/ui";
import { formatAccountingMoney, getWarehouseAccountingReport, parseAccountingFilters, type AccountingParams } from "@/lib/warehouse-accounting";

export default async function WarehouseAccountingPage({ searchParams }: { searchParams: Promise<AccountingParams> }) {
  await requireUser();
  const params = await searchParams;
  const [{ text, language }, report] = await Promise.all([getUiContext(), getWarehouseAccountingReport(params)]);
  const defaults = parseAccountingFilters({});
  if (!defaults.ok) throw new Error("Invalid current date");
  const filters = report.ok ? report.filters : defaults.filters;
  const mode = report.ok ? filters.mode : params.mode === "returns" ? "returns" : params.mode === "inbound" ? "inbound" : "outbound";
  const from = typeof params.from === "string" ? params.from : filters.from;
  const to = typeof params.to === "string" ? params.to : filters.to;
  const flow = report.ok ? filters.flow : mode === "returns" ? "RETURNS" : mode === "inbound" ? "MANUFACTURER_IN" : "CUSTOMER_OUT";
  const isNet = flow === "CUSTOMER_OUT";
  const isReturns = mode === "returns";
  const returnKind = report.ok ? filters.returnKind : "all";
  const tableHeaders = isNet
    ? [text.sku, text.product, text.accountingGrossQuantityShort, text.accountingReturnQuantityShort, text.accountingNetQuantityShort,
      text.accountingCurrentCost, text.accountingGrossValue, text.accountingReturnValue, text.accountingNetValue]
    : isReturns
      ? [text.sku, text.product, text.accountingHoan, text.accountingTra, text.accountingTotalReturns, text.accountingCurrentCost, text.accountingReturnValue]
      : [text.sku, text.product, text.quantity, text.accountingCurrentCost, text.accountingTotalValue];
  const control = "mt-2 block w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900";

  return (
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-950">{text.warehouseAccounting}</h1>
        <p className="mt-2 text-sm text-slate-600">{text.accountingCostNote}</p>
        <nav aria-label={text.warehouseAccounting} className="mt-5 flex flex-wrap gap-2">
          {(["outbound", "inbound", "returns"] as const).map((tab) => (
            <Link key={tab} prefetch={false} aria-current={mode === tab ? "page" : undefined}
              href={`/warehouse-accounting?${new URLSearchParams({ mode: tab, from, to,
                flow: tab === "returns" ? "RETURNS" : flow === "TRANSFER" ? flow : tab === "inbound" ? "MANUFACTURER_IN" : "CUSTOMER_OUT",
                ...(tab === "returns" ? { returnKind } : {}) })}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === tab ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-50"}`}>
              {tab === "returns" ? text.accountingReturns : tab === "outbound" ? text.accountingOutbound : text.accountingInbound}
            </Link>
          ))}
        </nav>
        <form action="/warehouse-accounting" method="get" className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto] xl:items-end">
          <input type="hidden" name="mode" value={mode} />
          {isReturns ? <>
            <input type="hidden" name="flow" value="RETURNS" />
            <label className="min-w-0 text-sm text-slate-600">{text.accountingReturnKind}
              <select key={returnKind} name="returnKind" defaultValue={returnKind} className={control}>
                <option value="all">{text.accountingReturnAll}</option>
                <option value="hoan">{text.accountingHoan}</option>
                <option value="tra">{text.accountingTra}</option>
              </select>
            </label>
          </> : <label className="min-w-0 text-sm text-slate-600">{text.accountingFlow}
            <select key={`${mode}-${flow}`} name="flow" defaultValue={flow} className={control}>
              {mode === "outbound"
                ? <option value="CUSTOMER_OUT">{text.accountingCustomerFlow}</option>
                : <option value="MANUFACTURER_IN">{text.accountingSupplierFlow}</option>}
              <option value="TRANSFER">{text.accountingTransferFlow}</option>
            </select>
          </label>}
          <label className="min-w-0 text-sm text-slate-600">{text.accountingFrom}
            <input key={`from-${from}`} type="date" name="from" required defaultValue={from} className={`${control} [color-scheme:light] [.theme-dark_&]:[color-scheme:dark]`} aria-describedby="accounting-date-hint" />
          </label>
          <label className="min-w-0 text-sm text-slate-600">{text.accountingTo}
            <input key={`to-${to}`} type="date" name="to" required defaultValue={to} className={`${control} [color-scheme:light] [.theme-dark_&]:[color-scheme:dark]`} aria-describedby="accounting-date-hint" />
          </label>
          <button type="submit" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{text.accountingApply}</button>
        </form>
        <p id="accounting-date-hint" className="mt-3 text-sm text-slate-500">{text.accountingDateHint}</p>
        {isNet && <p className="mt-3 text-sm text-slate-600">{text.accountingNetNote}</p>}
        {(isNet || isReturns) && <p className="mt-2 text-sm text-slate-500">{text.accountingPeriodNote}</p>}
        {flow === "MANUFACTURER_IN" && <p className="mt-3 text-sm text-slate-500">{text.accountingSupplierNote}</p>}
        {!report.ok && <p role="alert" className="mt-4 rounded-xl border border-slate-300 bg-rose-50 p-4 text-sm text-slate-900">{text[report.error]}</p>}
      </section>
      {report.ok && <>
        {isNet ? <section className="grid gap-4 sm:grid-cols-3" aria-label={text.warehouseAccounting}>
          {[
            { label: text.accountingGross, quantity: report.totalGrossQuantity, value: report.totalGrossValue },
            { label: text.accountingReturns, quantity: report.totalReturnQuantity, value: report.totalReturnValue },
            { label: text.accountingNet, quantity: report.totalNetQuantity, value: report.totalNetValue, net: true },
          ].map((card) => (
            <article key={card.label} aria-label={card.label}
              className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${card.net ? "ring-2 ring-emerald-600" : ""}`}>
              <h2 className="font-semibold text-slate-950">{card.label}</h2>
              <dl className="mt-3 space-y-2">
                <div><dt className="text-sm text-slate-500">{text.quantity}</dt>
                  <dd className="break-words text-2xl font-semibold text-slate-950">{formatNumber(card.quantity)}</dd></div>
                <div><dt className="text-sm text-slate-500">{text.accountingTotalValue}</dt>
                  <dd className="break-words text-xl font-semibold text-slate-950">{formatAccountingMoney(card.value, language)}</dd></div>
              </dl>
            </article>
          ))}
        </section> : <section className="grid gap-4 sm:grid-cols-2" aria-label={text.warehouseAccounting}>
          {[{ label: text.accountingTotalQuantity, value: formatNumber(report.totalQuantity) },
            { label: text.accountingTotalValue, value: formatAccountingMoney(report.totalValue, language) }].map((card) => (
            <article key={card.label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-3 break-words text-3xl font-semibold text-slate-950">{card.value}</p>
            </article>
          ))}
        </section>}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex justify-end">
            <a href={`/api/export/warehouse-accounting?${new URLSearchParams({
              mode: report.filters.mode, flow: report.filters.flow, from: report.filters.from, to: report.filters.to,
              ...(isReturns ? { returnKind: report.filters.returnKind } : {}),
            })}`} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              {text.accountingExport}
            </a>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className={`w-full divide-y divide-slate-200 text-left text-sm ${isNet ? "min-w-[1150px]" : isReturns ? "min-w-[900px]" : "min-w-[700px]"}`}>
              <caption className="sr-only">{text.warehouseAccounting}</caption>
              <thead className="bg-slate-50 text-slate-500"><tr>
                {tableHeaders.map((label, index) => (
                  <th key={label} scope="col" className={`px-4 py-3 font-medium ${index >= 2 ? "text-right" : ""}`}>{label}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {report.rows.length === 0 ? <tr><td colSpan={tableHeaders.length} className="px-4 py-10 text-center text-slate-500">{text.accountingEmpty}</td></tr>
                  : report.rows.map((row) => <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.sku}</td>
                    <td className="px-4 py-3 text-slate-900">{row.name}</td>
                    {isNet ? <>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.grossQuantity)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.returnQuantity)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">{formatNumber(row.netQuantity)}</td>
                    </> : isReturns ? <>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.hoanQuantity)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.traQuantity)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.returnQuantity)}</td>
                    </> : <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.quantity)}</td>}
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">{formatAccountingMoney(row.costPrice, language)}</td>
                    {isNet && <>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">{formatAccountingMoney(row.grossValue, language)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">{formatAccountingMoney(row.returnValue, language)}</td>
                    </>}
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-950">{formatAccountingMoney(row.value, language)}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </>}
    </div>
  );
}
