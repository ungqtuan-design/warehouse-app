"use client";

import { useBasket } from "@/components/basket-provider";

type BasketWorkspaceText = {
  basket: string;
  issueFromKhoLe: string;
  currentBasket: string;
  basketEmpty: string;
  source: string;
  quantity: string;
  remove: string;
  clearBasket: string;
  totalBasketItems: string;
};

export function BasketWorkspace({ text }: { text: BasketWorkspaceText }) {
  const { items, totalCount, removeItem, clearBasket } = useBasket();

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
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <article key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.sku}</p>
                </div>
                <button type="button" onClick={() => removeItem(item.key)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white">
                  {text.remove}
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>{item.supplierName}</p>
                <p>{text.source}: {item.warehouseName}</p>
                <p>{text.quantity}: {item.quantity}</p>
              </div>
            </article>
          ))}
          <button type="button" onClick={clearBasket} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            {text.clearBasket}
          </button>
        </div>
      )}
    </section>
  );
}