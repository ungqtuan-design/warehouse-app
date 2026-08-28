"use client";

import { useState } from "react";

import { searchSuppliersAction } from "@/app/actions/warehouse";
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
  loadMore: string;
  searching: string;
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
  supplierCount,
  text,
}: {
  supplierCount: number;
  text: SuppliersWorkspaceText;
}) {
  const [queryInput, setQueryInput] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SupplierRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  async function runSearch() {
    setLoading(true);
    setHasSearched(true);

    const page = await searchSuppliersAction({
      query: queryInput,
      includeInactive,
      skip: 0,
    });

    setResults(page.rows);
    setHasMore(page.hasMore);
    setLoading(false);
  }

  async function loadMore() {
    setLoading(true);

    const page = await searchSuppliersAction({
      query: queryInput,
      includeInactive,
      skip: results.length,
    });

    setResults((current) => [...current, ...page.rows]);
    setHasMore(page.hasMore);
    setLoading(false);
  }

  async function refreshVisibleResults() {
    const page = await searchSuppliersAction({
      query: queryInput,
      includeInactive,
      skip: 0,
      take: Math.max(results.length, 1),
    });

    setResults(page.rows);
    setHasMore(page.hasMore);
  }

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
          <button type="button" onClick={runSearch} disabled={loading} className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? text.searching : text.search}
          </button>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          {/* Header and rows share the exact same grid-cols template (not a
              <table>) so columns always line up — the header row has no
              per-row cells to size against since each data row is a single
              colspan-style <details> hosting its own inline edit form. */}
          <div className="min-w-[760px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 bg-slate-50 px-4 py-3 font-medium text-slate-500">
              <span>{text.supplier}</span>
              <span>{text.contact}</span>
              <span>{text.email}</span>
              <span>{text.phone}</span>
              <span>{text.status}</span>
              <span>{text.actions}</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {!hasSearched ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  {supplierCount === 0 ? text.noSuppliersRows : text.searchSupplierPrompt}
                </div>
              ) : results.length === 0 && loading ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  {text.searching}
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  {text.noSupplierMatches}
                </div>
              ) : results.map((supplier) => (
                <details key={supplier.id} className="group">
                  <summary className="grid cursor-pointer grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] items-start gap-4 px-4 py-3">
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
                  <SupplierUpdateForm supplier={supplier} text={text} onUpdated={refreshVisibleResults} />
                </details>
              ))}
            </div>
          </div>
        </div>

        {hasSearched && hasMore ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {loading ? text.searching : text.loadMore}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}