import { ChevronsUpDown } from "lucide-react";

import { createProductAction } from "@/app/actions/warehouse";
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
    </div>
  );
}
