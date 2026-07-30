import { BasketWorkspace } from "@/components/basket-workspace";
import { getBasketRows } from "@/lib/warehouse-data";
import { requireUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";

export default async function BasketPage() {
  await requireUser();

  const [basketRows, { text }] = await Promise.all([getBasketRows(), getUiContext()]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">{text.outboundBasket}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{text.issueFromKhoLe}</h1>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[760px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">{text.product}</th>
                <th className="px-4 py-3 font-medium">{text.available}</th>
                <th className="px-4 py-3 font-medium">{text.quantity}</th>
                <th className="px-4 py-3 font-medium">{text.customer}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {basketRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.noBasketRows}
                  </td>
                </tr>
              ) : basketRows.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{line.sku}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{line.product}</div>
                    <div className="text-xs text-slate-500">{text.source}: {line.source}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{line.available}</td>
                  <td className="px-4 py-3 text-slate-600">{line.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{line.customer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BasketWorkspace text={text} />
    </div>
  );
}
