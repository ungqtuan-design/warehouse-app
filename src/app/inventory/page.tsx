import { getProductRows } from "@/lib/warehouse-data";
import { requireUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { getUiContext } from "@/lib/ui";

export default async function InventoryPage() {
  await requireUser();

  const [rows, { text }] = await Promise.all([getProductRows(), getUiContext()]);
  const rankedProducts = rows.sort((left, right) => {
    if (left.totalQty === right.totalQty) {
      return right.outbound30d - left.outbound30d;
    }

    return left.totalQty - right.totalQty;
  });

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.inventoryManagement}</p>
            <h1 className="text-2xl font-semibold text-slate-950">{text.currentStockPosition}</h1>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {text.sortedBy}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[860px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{text.product}</th>
                <th className="px-4 py-3 font-medium">{text.supplier}</th>
                <th className="px-4 py-3 font-medium">{text.khoTong}</th>
                <th className="px-4 py-3 font-medium">{text.khoLe}</th>
                <th className="px-4 py-3 font-medium">{text.total}</th>
                <th className="px-4 py-3 font-medium">{text.outbound30d}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rankedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.noInventoryRows}
                  </td>
                </tr>
              ) : rankedProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{product.name}</div>
                    <div className="text-xs text-slate-500">{product.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{product.supplierName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(product.khoTongQty)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(product.khoLeQty)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{formatNumber(product.totalQty)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      {formatNumber(product.outbound30d)}
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
