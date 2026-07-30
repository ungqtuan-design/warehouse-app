"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type BasketWarehouse = "KHO_TONG" | "KHO_LE";

export type BasketItem = {
  key: string;
  productId: string;
  sku: string;
  name: string;
  supplierName: string;
  quantity: number;
  available: number;
  warehouse: BasketWarehouse;
  warehouseName: string;
};

type AddBasketItemInput = Omit<BasketItem, "key">;

type BasketContextValue = {
  items: BasketItem[];
  totalCount: number;
  addItem: (item: AddBasketItemInput) => { ok: boolean; message?: string };
  removeItem: (key: string) => void;
  clearBasket: () => void;
};

const STORAGE_KEY = "mims_basket";
const LEGACY_STORAGE_KEY = "wiings_basket";

const BasketContext = createContext<BasketContextValue | null>(null);

function getItemKey(productId: string, warehouse: BasketWarehouse) {
  return `${productId}:${warehouse}`;
}

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as BasketItem[];
      setItems(parsed);
      if (!window.localStorage.getItem(STORAGE_KEY) && window.localStorage.getItem(LEGACY_STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, raw);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<BasketContextValue>(() => ({
    items,
    totalCount: items.reduce((sum, item) => sum + item.quantity, 0),
    addItem: (item) => {
      const key = getItemKey(item.productId, item.warehouse);
      const existing = items.find((entry) => entry.key === key);
      const nextQuantity = (existing?.quantity ?? 0) + item.quantity;

      if (item.quantity <= 0) {
        return { ok: false, message: "invalid-quantity" };
      }

      if (nextQuantity > item.available) {
        return { ok: false, message: "exceeds-stock" };
      }

      setItems((current) => {
        const currentExisting = current.find((entry) => entry.key === key);

        if (!currentExisting) {
          return [...current, { ...item, key }];
        }

        return current.map((entry) => entry.key === key
          ? { ...entry, quantity: entry.quantity + item.quantity, available: item.available, warehouseName: item.warehouseName }
          : entry);
      });

      return { ok: true };
    },
    removeItem: (key) => {
      setItems((current) => current.filter((entry) => entry.key !== key));
    },
    clearBasket: () => {
      setItems([]);
    },
  }), [items]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const context = useContext(BasketContext);

  if (!context) {
    throw new Error("useBasket must be used within BasketProvider");
  }

  return context;
}