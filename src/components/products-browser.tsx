"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";

import { updateProductInlineAction } from "@/app/actions/warehouse";
import { useBasket } from "@/components/basket-provider";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  leadTimeDays: number;
  supplierId: string;
  supplierName: string;
  status: "ACTIVE" | "INACTIVE";
  khoTongQty: number;
  khoLeQty: number;
  totalQty: number;
  outbound7d: number;
  outbound30d: number;
};

type SupplierOption = {
  id: string;
  name: string;
};

type ProductsBrowserText = {
  searchProductOrSku: string;
  allSuppliers: string;
  actions: string;
  includeInactive: string;
  search: string;
  product: string;
  supplier: string;
  status: string;
  khoTong: string;
  khoLe: string;
  total: string;
  leadTimeDays: string;
  basketAction: string;
  active: string;
  inactive: string;
  addToBasket: string;
  quantity: string;
  daySuffix: string;
  searchWarehouse: string;
  allLocations: string;
  searchPrompt: string;
  noProductMatches: string;
  noProductsRows: string;
  exceedsStockMessage: string;
  addedToBasketMessage: string;
  selectWarehouseForBasket: string;
  edit: string;
  updateProduct: string;
  updateProductSuccess: string;
  updateProductError: string;
  invalidImageMessage: string;
  productImageUpload: string;
};

type WarehouseFilter = "ALL" | "KHO_TONG" | "KHO_LE";

function getAvailableQty(product: ProductRow, warehouse: WarehouseFilter) {
  if (warehouse === "KHO_TONG") {
    return product.khoTongQty;
  }

  if (warehouse === "KHO_LE") {
    return product.khoLeQty;
  }

  return product.totalQty;
}

export function ProductsBrowser({
  products,
  suppliers,
  text,
}: {
  products: ProductRow[];
  suppliers: SupplierOption[];
  text: ProductsBrowserText;
}) {
  const { addItem } = useBasket();
  const [query, setQuery] = useState("");
  const [supplierId, setSupplierId] = useState("ALL");
  const [warehouse, setWarehouse] = useState<WarehouseFilter>("ALL");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [editMessages, setEditMessages] = useState<Record<string, { kind: "success" | "error"; message: string }>>({});

  const supplierOptions = useMemo(() => suppliers, [suppliers]);
  const results = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSupplier = supplierId === "ALL" || product.supplierId === supplierId;
      const matchesStatus = includeInactive || product.status === "ACTIVE";
      const matchesWarehouse = warehouse === "ALL" || getAvailableQty(product, warehouse) > 0;
      const matchesQuery = trimmedQuery.length === 0
        ? true
        : product.name.toLowerCase().includes(trimmedQuery) || product.sku.toLowerCase().includes(trimmedQuery);

      return matchesSupplier && matchesStatus && matchesWarehouse && matchesQuery;
    });
  }, [includeInactive, products, query, supplierId, warehouse]);

  function runSearch() {
    setHasSearched(true);
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-5 lg:w-full xl:w-[980px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
          placeholder={text.searchProductOrSku}
        />
        <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500">
          <option value="ALL">{text.allSuppliers}</option>
          {supplierOptions.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
          ))}
        </select>
        <select value={warehouse} onChange={(event) => setWarehouse(event.target.value as WarehouseFilter)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500">
          <option value="ALL">{text.allLocations}</option>
          <option value="KHO_TONG">{text.searchWarehouse}: {text.khoTong}</option>
          <option value="KHO_LE">{text.searchWarehouse}: {text.khoLe}</option>
        </select>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          {text.includeInactive}
        </label>
        <button type="button" onClick={runSearch} className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500">
          {text.search}
        </button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1180px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">{text.actions}</th>
              <th className="px-4 py-3 font-medium">{text.product}</th>
              <th className="px-4 py-3 font-medium">{text.supplier}</th>
              <th className="px-4 py-3 font-medium">{text.status}</th>
              <th className="px-4 py-3 font-medium">{text.khoTong}</th>
              <th className="px-4 py-3 font-medium">{text.khoLe}</th>
              <th className="px-4 py-3 font-medium">{text.total}</th>
              <th className="px-4 py-3 font-medium">{text.leadTimeDays}</th>
              <th className="px-4 py-3 font-medium">{text.quantity}</th>
              <th className="px-4 py-3 font-medium">{text.basketAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {!hasSearched ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                  {products.length === 0 ? text.noProductsRows : text.searchPrompt}
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                  {text.noProductMatches}
                </td>
              </tr>
            ) : results.map((product) => {
              const availableQty = getAvailableQty(product, warehouse);
              const quantityValue = quantities[product.id] ?? "";
              const parsedQty = Number(quantityValue || 0);
              const requiresWarehouseSelection = warehouse === "ALL";
              const basketWarehouse = warehouse === "KHO_TONG" ? "KHO_TONG" : "KHO_LE";
              const invalidQty = !Number.isFinite(parsedQty) || parsedQty <= 0 || parsedQty > availableQty || product.status !== "ACTIVE" || requiresWarehouseSelection;

              return (
                <ProductTableRows
                  key={product.id}
                  product={product}
                  suppliers={suppliers}
                  text={text}
                  availableQty={availableQty}
                  quantityValue={quantityValue}
                  parsedQty={parsedQty}
                  requiresWarehouseSelection={requiresWarehouseSelection}
                  invalidQty={invalidQty}
                  isExpanded={expandedProductId === product.id}
                  basketWarehouse={basketWarehouse}
                  message={messages[product.id] ?? ""}
                  editMessage={editMessages[product.id]}
                  onQuantityChange={(value) => setQuantities((current) => ({ ...current, [product.id]: value }))}
                  onToggleEdit={() => {
                    setExpandedProductId((current) => current === product.id ? null : product.id);
                    setEditMessages((current) => ({ ...current, [product.id]: undefined as never }));
                  }}
                  onBasketAdd={() => {
                    const result = addItem({
                      productId: product.id,
                      sku: product.sku,
                      name: product.name,
                      supplierName: product.supplierName,
                      quantity: parsedQty,
                      available: availableQty,
                      warehouse: basketWarehouse,
                      warehouseName: basketWarehouse === "KHO_TONG" ? text.khoTong : text.khoLe,
                    });

                    setMessages((current) => ({
                      ...current,
                      [product.id]: result.ok ? text.addedToBasketMessage : (result.message === "exceeds-stock" ? text.exceedsStockMessage : ""),
                    }));

                    if (result.ok) {
                      setQuantities((current) => ({ ...current, [product.id]: "" }));
                    }
                  }}
                  onEditResult={(kind, message) => {
                    setEditMessages((current) => ({ ...current, [product.id]: { kind, message } }));
                    if (kind === "success") {
                      setExpandedProductId(null);
                    }
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductTableRows({
  product,
  suppliers,
  text,
  availableQty,
  quantityValue,
  parsedQty,
  requiresWarehouseSelection,
  invalidQty,
  isExpanded,
  basketWarehouse,
  message,
  editMessage,
  onQuantityChange,
  onToggleEdit,
  onBasketAdd,
  onEditResult,
}: {
  product: ProductRow;
  suppliers: SupplierOption[];
  text: ProductsBrowserText & { actions: string };
  availableQty: number;
  quantityValue: string;
  parsedQty: number;
  requiresWarehouseSelection: boolean;
  invalidQty: boolean;
  isExpanded: boolean;
  basketWarehouse: "KHO_TONG" | "KHO_LE";
  message: string;
  editMessage?: { kind: "success" | "error"; message: string };
  onQuantityChange: (value: string) => void;
  onToggleEdit: () => void;
  onBasketAdd: () => void;
  onEditResult: (kind: "success" | "error", message: string) => void;
}) {
  return (
    <>
      <tr>
        <td className="px-4 py-3 font-medium text-slate-900">{product.sku}</td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggleEdit}
            className="inline-flex rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-50"
            aria-label={text.edit}
            title={text.edit}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-xl border border-slate-200 object-cover" />
            ) : null}
            <div>
              <div className="font-medium text-slate-900">{product.name}</div>
              {editMessage ? (
                <p className={`mt-1 text-xs ${editMessage.kind === "success" ? "text-emerald-700" : "text-rose-700"}`}>
                  {editMessage.message}
                </p>
              ) : null}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-slate-600">{product.supplierName}</td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {product.status === "ACTIVE" ? text.active : text.inactive}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-600">{product.khoTongQty}</td>
        <td className="px-4 py-3 text-slate-600">{product.khoLeQty}</td>
        <td className="px-4 py-3 font-semibold text-slate-900">{product.totalQty}</td>
        <td className="px-4 py-3 text-slate-600">{product.leadTimeDays} {text.daySuffix}</td>
        <td className="px-4 py-3">
          <input
            type="number"
            min="1"
            max={availableQty}
            value={quantityValue}
            onChange={(event) => onQuantityChange(event.target.value)}
            className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-cyan-500"
          />
        </td>
        <td className="px-4 py-3">
          <div className="grid gap-2">
            <button
              type="button"
              disabled={invalidQty}
              onClick={onBasketAdd}
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {text.addToBasket}
            </button>
            <p className="text-xs text-slate-500">
              {requiresWarehouseSelection
                ? text.selectWarehouseForBasket
                : parsedQty > availableQty
                  ? text.exceedsStockMessage
                  : message}
            </p>
          </div>
        </td>
      </tr>
      {isExpanded ? (
        <ProductEditInlineRow product={product} suppliers={suppliers} text={text} basketWarehouse={basketWarehouse} onResult={onEditResult} />
      ) : null}
    </>
  );
}

function ProductEditInlineRow({
  product,
  suppliers,
  text,
  onResult,
}: {
  product: ProductRow;
  suppliers: SupplierOption[];
  text: ProductsBrowserText & { product: string; supplier: string; leadTimeDays: string; active: string };
  basketWarehouse: "KHO_TONG" | "KHO_LE";
  onResult: (kind: "success" | "error", message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(updateProductInlineAction, {
    status: "idle" as const,
    message: "",
  });

  useEffect(() => {
    if (state.status === "success") {
      onResult("success", text.updateProductSuccess);
    }

    if (state.status === "error") {
      const message = state.message === "Invalid image file." ? text.invalidImageMessage : text.updateProductError;
      onResult("error", message);
    }
  }, [onResult, state.message, state.status, text.invalidImageMessage, text.updateProductError, text.updateProductSuccess]);

  return (
    <tr className="bg-slate-50">
      <td colSpan={11} className="px-4 py-4">
        <form action={formAction} className="grid gap-4 lg:grid-cols-2">
          <input type="hidden" name="productId" value={product.id} />
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.product}
            <input name="name" defaultValue={product.name} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.supplier}
            <select name="supplierId" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" defaultValue={product.supplierId} required>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
            {text.productImageUpload}
            <input name="imageFile" type="file" accept="image/*" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.leadTimeDays}
            <input name="leadTimeDays" type="number" min="0" defaultValue={product.leadTimeDays} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
            <input name="isActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked={product.status === "ACTIVE"} />
            {text.active}
          </label>
          <div className="lg:col-span-2">
            <button type="submit" disabled={pending} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {text.updateProduct}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}