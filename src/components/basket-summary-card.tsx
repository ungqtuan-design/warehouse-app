"use client";

import Link from "next/link";

import { useBasket } from "@/components/basket-provider";

export function BasketSummaryCard({ text }: { text: { basket: string; basketSummary: string; totalBasketItems: string } }) {
  const { totalCount } = useBasket();

  return (
    <div className="mx-3 mb-4 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-slate-50 lg:mx-4">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">{text.basketSummary}</p>
      <p className="mt-3 text-3xl font-semibold">{totalCount}</p>
      <p className="mt-1 text-sm text-slate-300">{text.totalBasketItems}</p>
      <Link href="/basket" className="mt-4 inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800">
        {text.basket}
      </Link>
    </div>
  );
}