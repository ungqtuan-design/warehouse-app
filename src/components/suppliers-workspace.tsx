"use client";

import { useMemo, useState } from "react";

import { SupplierUpdateForm } from "@/components/supplier-forms";

type SupplierRow = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTerms: string | null;
  deliveryMethod: string | null;
  pastIssues: string | null;
  isActive: boolean;
};

type SuppliersWorkspaceText = {
  supplierMaster: string;
  suppliers: string;
  basicFieldsOnly: string;
  supplier: string;
  contactPerson: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  actions: string;
  active: string;
  inactive: string;
  update: string;
  noSuppliersRows: string;
  search: string;
  includeInactive: string;
  searchSupplierContactEmailAddress: string;
  searchSupplierPrompt: string;
  noSupplierMatches: string;
  enterSupplierName: string;
  contactPersonPlaceholder: string;
  phoneNumberPlaceholder: string;
  emailAddressPlaceholder: string;
  basicSupplierAddressPlaceholder: string;
  paymentTerms: string;
  paymentTermsPlaceholder: string;
  deliveryMethod: string;
  deliveryMethodPlaceholder: string;
  pastIssues: string;
  pastIssuesPlaceholder: string;
  submit: string;
  submitting: string;
  updateSupplier: string;
  supplierCreateSuccess: string;
  supplierCreateError: string;
  supplierUpdateSuccess: string;
  supplierUpdateError: string;
};

export function SuppliersWorkspace({
  suppliers,
  text,
}: {
  suppliers: SupplierRow[];
  text: SuppliersWorkspaceText;
}) {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesStatus = includeInactive || supplier.isActive;

      if (!matchesStatus) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const haystack = [supplier.name, supplier.contactName, supplier.email, supplier.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [includeInactive, query, suppliers]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{text.supplierMaster}</p>
          <h1 className="text-2xl font-semibold text-slate-950">{text.suppliers}</h1>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          {text.basicFieldsOnly}
        </span>
      </div>

      <div className="mt-5">
        <div className="grid gap-3 md:grid-cols-3 lg:w-full xl:w-[980px]">
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
            placeholder={text.searchSupplierContactEmailAddress}
          />
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {text.includeInactive}
          </label>
          <button type="button" onClick={() => {
            setHasSearched(true);
            setQuery(queryInput);
          }} className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500">
            {text.search}
          </button>
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
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.searchSupplierPrompt}
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.noSupplierMatches}
                  </td>
                </tr>
              ) : results.map((supplier) => (
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
      </div>
    </section>
  );
}