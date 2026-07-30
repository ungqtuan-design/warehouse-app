"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Ban } from "lucide-react";

import { submitBasketAction } from "@/app/actions/warehouse";
import { useBasket } from "@/components/basket-provider";

type BasketWorkspaceText = {
  basket: string;
  issueFromKhoLe: string;
  currentBasket: string;
  basketEmpty: string;
  supplier: string;
  source: string;
  quantity: string;
  remove: string;
  clearBasket: string;
  totalBasketItems: string;
  customerName: string;
  customerOrLineName: string;
  deliveryOrIssueReference: string;
  note: string;
  confirmIssue: string;
  basketSubmitSuccess: string;
  basketSubmitError: string;
  basketStockError: string;
};

export function BasketWorkspace({ text }: { text: BasketWorkspaceText }) {
  const { items, totalCount, removeItem, clearBasket } = useBasket();
  const [customerName, setCustomerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [state, formAction, pending] = useActionState(submitBasketAction, {
    status: "idle" as const,
    message: "",
  });

  const serializedLines = useMemo(() => JSON.stringify(items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    warehouse: item.warehouse,
  }))), [items]);

  useEffect(() => {
    if (state.status === "success") {
      clearBasket();
      setCustomerName("");
      setReferenceNo("");
      setNote("");
    }
  }, [clearBasket, state.status]);

  const submitMessage = state.status === "success"
    ? text.basketSubmitSuccess
    : state.status === "error"
      ? (state.message === "One or more basket items exceed available stock." ? text.basketStockError : text.basketSubmitError)
      : "";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{text.basket}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{text.currentBasket}</h2>
        </div>
        <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">
          {text.totalBasketItems}: {totalCount}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          {text.basketEmpty}
        </p>
      ) : (
        <form action={formAction} className="mt-5 grid gap-4">
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {text.customerName}
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} name="customerName" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.customerOrLineName} required />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {text.deliveryOrIssueReference}
              <input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} name="referenceNo" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {text.note}
              <input value={note} onChange={(event) => setNote(event.target.value)} name="note" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
            </label>
          </div>

          <input type="hidden" name="linesJson" value={serializedLines} />

          <div className="grid gap-3">
          {items.map((item) => (
            <article key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.sku}</p>
                </div>
                <button type="button" onClick={() => removeItem(item.key)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100" aria-label={text.remove} title={text.remove}>
                  <Ban className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{text.supplier}</p>
                  <p className="mt-2 font-medium text-slate-800">{item.supplierName}</p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{text.source}</p>
                  <p className="mt-2 font-medium text-slate-800">{item.warehouseName}</p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{text.quantity}</p>
                  <p className="mt-2 font-medium text-slate-800">{item.quantity}</p>
                </div>
              </div>
            </article>
          ))}
          </div>
          {submitMessage ? <p className={`text-sm ${state.status === "success" ? "text-emerald-700" : "text-rose-700"}`}>{submitMessage}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={clearBasket} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              {text.clearBasket}
            </button>
            <button type="submit" disabled={pending || items.length === 0} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {text.confirmIssue}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}