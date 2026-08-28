import { ChevronsUpDown } from "lucide-react";

import { SupplierCreateForm, SupplierUpdateForm } from "@/components/supplier-forms";
import { SuppliersWorkspace } from "@/components/suppliers-workspace";
import { requireUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";
import { getSupplierCount } from "@/lib/warehouse-data";

export default async function SuppliersPage() {
  await requireUser();

  const [supplierCount, { text }] = await Promise.all([getSupplierCount(), getUiContext()]);

  return (
    <div className="grid gap-6">
      <SuppliersWorkspace supplierCount={supplierCount} text={text} />

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
