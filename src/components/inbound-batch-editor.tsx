"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createInboundBatchAction } from "@/app/actions/warehouse";
import { ActionToast, primaryActionButtonClass, secondaryActionButtonClass, type ActionNotice } from "@/components/action-feedback";
import { idleFormActionState } from "@/lib/action-state";

type InboundProductOption = {
  id: string;
  sku: string;
  name: string;
  supplierName: string;
};

type InboundBatchText = {
  product: string;
  supplier: string;
  quantity: string;
  note: string;
  actions: string;
  addRow: string;
  remove: string;
  productLookupPlaceholder: string;
  selectProductFromList: string;
  submit: string;
  submitting: string;
  inboundSubmitSuccess: string;
  inboundSubmitError: string;
};

type InboundDraftRow = {
  id: string;
  productQuery: string;
  productId: string;
  quantity: string;
  note: string;
};

function createRow(): InboundDraftRow {
  return {
    id: crypto.randomUUID(),
    productQuery: "",
    productId: "",
    quantity: "",
    note: "",
  };
}

export function InboundBatchEditor({
  products,
  text,
}: {
  products: InboundProductOption[];
  text: InboundBatchText;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<InboundDraftRow[]>([createRow()]);
  const [notice, setNotice] = useState<ActionNotice>(null);
  const [state, formAction, pending] = useActionState(createInboundBatchAction, idleFormActionState);

  const optionsByLookup = new Map<string, InboundProductOption>();

  for (const product of products) {
    optionsByLookup.set(`${product.sku} - ${product.name}`, product);
    optionsByLookup.set(product.sku, product);
    optionsByLookup.set(product.name, product);
  }

  const serializedLines = JSON.stringify(
    rows
      .filter((row) => row.productId && Number(row.quantity) > 0)
      .map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
        note: row.note.trim(),
      })),
  );

  const hasInvalidRow = rows.some((row) => !row.productId || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setRows([createRow()]);
      router.refresh();
      setNotice({ kind: "success", message: text.inboundSubmitSuccess });
      return;
    }

    if (state.status === "error") {
      setNotice({ kind: "error", message: text.inboundSubmitError });
    }
  }, [router, state.status, text.inboundSubmitError, text.inboundSubmitSuccess]);

  function syncRowProduct(rowId: string, nextQuery: string) {
    const matched = optionsByLookup.get(nextQuery.trim());

    setRows((current) => current.map((row) => row.id === rowId
      ? {
          ...row,
          productQuery: nextQuery,
          productId: matched?.id ?? "",
        }
      : row));
  }

  return (
    <>
    <form ref={formRef} action={formAction} className="grid gap-4">
      <input type="hidden" name="linesJson" value={serializedLines} />

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[920px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{text.product}</th>
              <th className="px-4 py-3 font-medium">{text.supplier}</th>
              <th className="px-4 py-3 font-medium">{text.quantity}</th>
              <th className="px-4 py-3 font-medium">{text.note}</th>
              <th className="px-4 py-3 font-medium">{text.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, index) => {
              const matchedProduct = products.find((product) => product.id === row.productId) ?? null;

              return (
                <tr key={row.id}>
                  <td className="px-4 py-3 align-top">
                    <input
                      value={row.productQuery}
                      onChange={(event) => syncRowProduct(row.id, event.target.value)}
                      list={`inbound-products-${index}`}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
                      placeholder={text.productLookupPlaceholder}
                    />
                    <datalist id={`inbound-products-${index}`}>
                      {products.map((product) => (
                        <option key={product.id} value={`${product.sku} - ${product.name}`}>
                          {product.supplierName}
                        </option>
                      ))}
                    </datalist>
                    {!matchedProduct ? <p className="mt-2 text-xs text-amber-700">{text.selectProductFromList}</p> : null}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <div className="font-medium text-slate-900">{matchedProduct?.supplierName ?? "-"}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(event) => setRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, quantity: event.target.value } : entry))}
                      className="w-28 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      value={row.note}
                      onChange={(event) => setRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, note: event.target.value } : entry))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.length === 1 ? [createRow()] : current.filter((entry) => entry.id !== row.id))}
                      className={secondaryActionButtonClass}
                    >
                      {text.remove}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, createRow()])}
          className={secondaryActionButtonClass}
        >
          {text.addRow}
        </button>
        <button
          type="submit"
          disabled={pending || rows.length === 0 || hasInvalidRow}
          className={primaryActionButtonClass}
        >
          {pending ? text.submitting : text.submit}
        </button>
      </div>
    </form>
    <ActionToast notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}