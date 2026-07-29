import { products } from "@/lib/mock-data";

const rankedProducts = [...products].sort((left, right) => {
  const leftTotal = left.khoTongQty + left.khoLeQty;
  const rightTotal = right.khoTongQty + right.khoLeQty;

  if (leftTotal === rightTotal) {
    return right.outbound30d - left.outbound30d;
  }

  return leftTotal - rightTotal;
});

export default function InventoryPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Inventory management</p>
            <h1 className="text-2xl font-semibold text-slate-950">Current stock position</h1>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Sorted by total stock ascending, then 30-day outbound descending.
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">kho tong</th>
                <th className="px-4 py-3 font-medium">kho le</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Outbound 30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rankedProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{product.name}</div>
                    <div className="text-xs text-slate-500">{product.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{product.supplierName}</td>
                  <td className="px-4 py-3 text-slate-600">{product.khoTongQty}</td>
                  <td className="px-4 py-3 text-slate-600">{product.khoLeQty}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{product.khoTongQty + product.khoLeQty}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      {product.outbound30d}
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
