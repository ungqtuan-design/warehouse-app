import { ChevronsUpDown } from "lucide-react";

import { createProductAction, updateProductAction } from "@/app/actions/warehouse";
import { ProductsBrowser } from "@/components/products-browser";
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
        </div>

        <div className="mt-5">
          <ProductsBrowser products={products} suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))} text={text} />
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
            <input name="name" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.enterProductName} required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.supplier}
            <select name="supplierId" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" defaultValue="" required>
              <option value="" disabled>{text.selectSupplier}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
            {text.productImageUpload}
            <input name="imageFile" type="file" accept="image/*" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.leadTimeDays}
            <input name="leadTimeDays" type="number" min="0" defaultValue="0" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input name="isActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
            {text.active}
          </label>
          <div className="lg:col-span-2">
            <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto">
              {text.saveProduct}
            </button>
          </div>
        </form>
      </details>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.currentCatalog}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{text.editProduct}</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {products.length}
          </span>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[900px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">{text.product}</th>
                <th className="px-4 py-3 font-medium">{text.supplier}</th>
                <th className="px-4 py-3 font-medium">{text.status}</th>
                <th className="px-4 py-3 font-medium">{text.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {products.map((product) => (
                <tr key={product.id}>
                  <td colSpan={5} className="px-0 py-0">
                    <details className="group">
                      <summary className="grid cursor-pointer grid-cols-[140px_1.6fr_1fr_140px_auto] items-center gap-4 px-4 py-3">
                        <div className="font-medium text-slate-900">{product.sku}</div>
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-xl border border-slate-200 object-cover" /> : null}
                          <div className="font-medium text-slate-900">{product.name}</div>
                        </div>
                        <div className="text-slate-600">{product.supplierName}</div>
                        <div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {product.status === "ACTIVE" ? text.active : text.inactive}
                          </span>
                        </div>
                        <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition group-hover:bg-slate-50">
                          {text.edit}
                        </span>
                      </summary>
                      <form action={updateProductAction} className="grid gap-4 border-t border-slate-200 bg-slate-50 px-4 py-4 lg:grid-cols-2">
                        <input type="hidden" name="productId" value={product.id} />
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          {text.product}
                          <input name="name" defaultValue={product.name} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" required />
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          {text.supplier}
                          <select name="supplierId" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" defaultValue={product.supplierId} required>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
                          {text.productImageUpload}
                          <input name="imageFile" type="file" accept="image/*" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          {text.leadTimeDays}
                          <input name="leadTimeDays" type="number" min="0" defaultValue={product.leadTimeDays} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                          <input name="isActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked={product.status === "ACTIVE"} />
                          {text.active}
                        </label>
                        <div className="lg:col-span-2">
                          <button type="submit" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                            {text.updateProduct}
                          </button>
                        </div>
                      </form>
                    </details>
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
