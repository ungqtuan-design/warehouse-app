"use client";

import { useBasket } from "@/components/basket-provider";
import { formatNumber } from "@/lib/format";

export function InventoryBasketCount() {
  const { totalCount } = useBasket();

  return (
    <span className="ml-auto inline-flex min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-100">
      {formatNumber(totalCount)}
    </span>
  );
}