import { ChevronsUpDown } from "lucide-react";

import { createProductAction } from "@/app/actions/warehouse";
import { requireUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";
import { getProductRows, getSuppliers } from "@/lib/warehouse-data";

export default async function ProductsPage() {
  await requireUser();

  const [products, suppliers, { text }] = await Promise.all([getProductRows(), getSuppliers(), getUiContext()]);

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.catalogManagement}</p>
            <h1 className="text-2xl font-semibold text-slate-950">{text.products}</h1>
          </div>
          <div className="grid gap-3 md:grid-cols-4 lg:w-[760px]">
            <input className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500" placeholder={text.searchProductOrSku} />
            <select className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500">
              <option>{text.allSuppliers}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id}>{supplier.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              {text.includeInactive}
            </label>
            <button type="button" className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500">
              {text.search}
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[900px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">{text.product}</th>
                <th className="px-4 py-3 font-medium">{text.supplier}</th>
                <th className="px-4 py-3 font-medium">{text.status}</th>
                <th className="px-4 py-3 font-medium">{text.khoTong}</th>
                <th className="px-4 py-3 font-medium">{text.khoLe}</th>
                <th className="px-4 py-3 font-medium">{text.total}</th>
                <th className="px-4 py-3 font-medium">{text.leadTimeDays}</th>
                <th className="px-4 py-3 font-medium">{text.basketAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    No products in Neon yet.
                  </td>
                </tr>
              ) : products.map((product) => {
                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{product.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{product.name}</div>
                      <div className="text-xs text-slate-500">{product.isObsolete ? text.obsolete : text.currentCatalog}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.supplierName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {product.status === "ACTIVE" ? text.active : text.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.khoTongQty}</td>
                    <td className="px-4 py-3 text-slate-600">{product.khoLeQty}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{product.totalQty}</td>
                    <td className="px-4 py-3 text-slate-600">{product.leadTimeDays} {text.daySuffix}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100">
                        {text.addToBasket}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.createProduct}</p>
            <h2 className="text-xl font-semibold text-slate-950">{text.newCatalogItem}</h2>
          </div>
          <div className="inline-flex items-center rounded-full border border-slate-400 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            <ChevronsUpDown className="h-4 w-4" />
          </div>
        </summary>
        <form action={createProductAction} className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.product}
            <input name="name" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Enter product name" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.supplier}
            <select name="supplierId" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" defaultValue="" required>
              <option value="" disabled>Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
            {text.productImageUrl}
            <input name="imageUrl" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="https://..." />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.leadTimeDays}
            <input name="leadTimeDays" type="number" min="0" defaultValue="0" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input name="isActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
            {text.active}
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input name="isObsolete" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            {text.obsolete}
          </label>
          <div className="lg:col-span-2">
            <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto">
              {text.saveProduct}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
