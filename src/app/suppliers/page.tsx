import { ChevronsUpDown } from "lucide-react";

import { SupplierCreateForm, SupplierUpdateForm } from "@/components/supplier-forms";
import { requireUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";
import { getSuppliers } from "@/lib/warehouse-data";

export default async function SuppliersPage() {
  await requireUser();

  const [suppliers, { text }] = await Promise.all([getSuppliers(), getUiContext()]);

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.supplierMaster}</p>
            <h1 className="text-2xl font-semibold text-slate-950">{text.suppliers}</h1>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            {text.basicFieldsOnly}
          </span>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[760px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{text.supplier}</th>
                <th className="px-4 py-3 font-medium">{text.contact}</th>
                <th className="px-4 py-3 font-medium">{text.email}</th>
                <th className="px-4 py-3 font-medium">{text.phone}</th>
                <th className="px-4 py-3 font-medium">{text.status}</th>
                <th className="px-4 py-3 font-medium">{text.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.noSuppliersRows}
                  </td>
                </tr>
              ) : suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td colSpan={6} className="px-0 py-0">
                    <details className="group">
                      <summary className="grid cursor-pointer grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3">
                        <div>
                          <div className="font-medium text-slate-900">{supplier.name}</div>
                          <div className="text-xs text-slate-500">{supplier.address}</div>
                        </div>
                        <div className="text-slate-600">{supplier.contactName}</div>
                        <div className="text-slate-600">{supplier.email}</div>
                        <div className="text-slate-600">{supplier.phone}</div>
                        <div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${supplier.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {supplier.isActive ? text.active : text.inactive}
                          </span>
                        </div>
                        <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition group-hover:bg-slate-50">
                          {text.update}
                        </span>
                      </summary>
                      <SupplierUpdateForm supplier={supplier} text={text} />
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.createSupplier}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{text.supplierForm}</h2>
          </div>
          <div className="inline-flex items-center rounded-full border border-slate-400 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            <ChevronsUpDown className="h-4 w-4" />
          </div>
        </summary>
        <SupplierCreateForm text={text} />
      </details>
    </div>
  );
}
