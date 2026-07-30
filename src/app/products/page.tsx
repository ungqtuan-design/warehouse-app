import { ChevronsUpDown } from "lucide-react";

import { ProductCreateForm } from "@/components/product-create-form";
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
        <ProductCreateForm suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))} text={text} />
      </details>
    </div>
  );
}
