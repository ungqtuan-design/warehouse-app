"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";

import { submitBasketAction } from "@/app/actions/warehouse";
import { ActionToast, primaryActionButtonClass, secondaryActionButtonClass, type ActionNotice } from "@/components/action-feedback";
import { useBasket } from "@/components/basket-provider";

type BasketWorkspaceText = {
  basket: string;
  outboundBasket: string;
  currentBasket: string;
  outboundHistory: string;
  basketEmpty: string;
  supplier: string;
  source: string;
  quantity: string;
  remove: string;
  clearBasket: string;
  totalBasketItems: string;
  note: string;
  submit: string;
  submitting: string;
  basketSubmitSuccess: string;
  basketSubmitError: string;
  basketStockError: string;
  noBasketRows: string;
  created: string;
  product: string;
  actions: string;
};

type BasketHistoryRow = {
  id: string;
  sku: string;
  product: string;
  source: string;
  quantity: number;
  note: string;
  createdAt: string;
};

export function BasketWorkspace({
  text,
  historyRows,
}: {
  text: BasketWorkspaceText;
  historyRows: BasketHistoryRow[];
}) {
  const router = useRouter();
  const { items, totalCount, removeItem, clearBasket } = useBasket();
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<ActionNotice>(null);
  const handledStateRef = useRef<string>("idle:");
  const [state, formAction, pending] = useActionState(submitBasketAction, {
    status: "idle" as const,
    message: "",
  });

  const serializedLines = useMemo(() => JSON.stringify(items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    warehouse: item.warehouse,
    note: lineNotes[item.key]?.trim() ?? "",
  }))), [items, lineNotes]);

  useEffect(() => {
    const currentStateKey = `${state.status}:${state.message}`;

    if (handledStateRef.current === currentStateKey) {
      return;
    }

    handledStateRef.current = currentStateKey;

    if (state.status === "success") {
      clearBasket();
      setLineNotes({});
      setNotice({ kind: "success", message: text.basketSubmitSuccess });
      startTransition(() => {
        router.refresh();
      });
      return;
    }

    if (state.status === "error") {
      setNotice({
        kind: "error",
        message: state.message === "One or more basket items exceed available stock." ? text.basketStockError : text.basketSubmitError,
      });
    }
  }, [clearBasket, router, state.message, state.status, text.basketStockError, text.basketSubmitError, text.basketSubmitSuccess]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{text.outboundBasket}</p>
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
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[920px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">{text.product}</th>
                  <th className="px-4 py-3 font-medium">{text.supplier}</th>
                  <th className="px-4 py-3 font-medium">{text.source}</th>
                  <th className="px-4 py-3 font-medium">{text.quantity}</th>
                  <th className="px-4 py-3 font-medium">{text.note}</th>
                  <th className="px-4 py-3 font-medium">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item) => (
                  <tr key={item.key}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.sku}</td>
                    <td className="px-4 py-3 text-slate-700">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.supplierName}</td>
                    <td className="px-4 py-3 text-slate-600">{item.warehouseName}</td>
                    <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3">
                      <input
                        value={lineNotes[item.key] ?? ""}
                        onChange={(event) => setLineNotes((current) => ({
                          ...current,
                          [item.key]: event.target.value,
                        }))}
                        className="w-full min-w-48 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
                        placeholder={text.note}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => removeItem(item.key)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100" aria-label={text.remove} title={text.remove}>
                        <Ban className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <input type="hidden" name="linesJson" value={serializedLines} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={clearBasket} className={secondaryActionButtonClass}>
              {text.clearBasket}
            </button>
            <button type="submit" disabled={pending || items.length === 0} className={primaryActionButtonClass}>
              {pending ? text.submitting : text.submit}
            </button>
          </div>
        </form>
      )}

      <div className="mt-8">
        <div>
          <p className="text-sm font-medium text-slate-500">{text.outboundBasket}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{text.outboundHistory}</h3>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[760px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">{text.product}</th>
                <th className="px-4 py-3 font-medium">{text.source}</th>
                <th className="px-4 py-3 font-medium">{text.quantity}</th>
                <th className="px-4 py-3 font-medium">{text.note}</th>
                <th className="px-4 py-3 font-medium">{text.created}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {historyRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.noBasketRows}
                  </td>
                </tr>
              ) : historyRows.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{line.sku}</td>
                  <td className="px-4 py-3 text-slate-700">{line.product}</td>
                  <td className="px-4 py-3 text-slate-600">{line.source}</td>
                  <td className="px-4 py-3 text-slate-700">{line.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{line.note}</td>
                  <td className="px-4 py-3 text-slate-600">{line.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ActionToast notice={notice} onClose={() => setNotice(null)} />
    </section>
  );
}