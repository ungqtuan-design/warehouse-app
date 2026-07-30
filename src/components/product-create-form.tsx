"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createProductAction } from "@/app/actions/warehouse";
import { ActionToast, primaryActionButtonClass, type ActionNotice } from "@/components/action-feedback";
import { idleFormActionState } from "@/lib/action-state";

type ProductCreateText = {
  product: string;
  supplier: string;
  productImageUpload: string;
  leadTimeDays: string;
  active: string;
  enterProductName: string;
  selectSupplier: string;
  submit: string;
  submitting: string;
  invalidImageMessage: string;
  productCreateSuccess: string;
  productCreateError: string;
};

type SupplierOption = {
  id: string;
  name: string;
};

export function ProductCreateForm({
  suppliers,
  text,
}: {
  suppliers: SupplierOption[];
  text: ProductCreateText;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<ActionNotice>(null);
  const [state, formAction, pending] = useActionState(createProductAction, idleFormActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
      setNotice({ kind: "success", message: text.productCreateSuccess });
      return;
    }

    if (state.status === "error") {
      setNotice({
        kind: "error",
        message: state.message === "invalid-image" ? text.invalidImageMessage : text.productCreateError,
      });
    }
  }, [router, state.message, state.status, text.invalidImageMessage, text.productCreateError, text.productCreateSuccess]);

  return (
    <>
      <form ref={formRef} action={formAction} className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.product}
          <input name="name" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.enterProductName} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.supplier}
          <select name="supplierId" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" defaultValue="" required>
            <option value="" disabled>{text.selectSupplier}</option>
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
          <input name="leadTimeDays" type="number" min="0" defaultValue="0" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input name="isActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
          {text.active}
        </label>
        <div className="lg:col-span-2">
          <button type="submit" disabled={pending} className={`w-full sm:w-auto ${primaryActionButtonClass}`}>
            {pending ? text.submitting : text.submit}
          </button>
        </div>
      </form>
      <ActionToast notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}