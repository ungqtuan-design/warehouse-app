"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupplierAction, updateSupplierAction } from "@/app/actions/warehouse";
import { ActionToast, primaryActionButtonClass, type ActionNotice } from "@/components/action-feedback";
import { idleFormActionState } from "@/lib/action-state";

type SupplierText = {
  supplier: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: string;
  enterSupplierName: string;
  contactPersonPlaceholder: string;
  phoneNumberPlaceholder: string;
  emailAddressPlaceholder: string;
  basicSupplierAddressPlaceholder: string;
  submit: string;
  submitting: string;
  updateSupplier: string;
  supplierCreateSuccess: string;
  supplierCreateError: string;
  supplierUpdateSuccess: string;
  supplierUpdateError: string;
};

type SupplierRow = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
};

export function SupplierCreateForm({ text }: { text: SupplierText }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<ActionNotice>(null);
  const [state, formAction, pending] = useActionState(createSupplierAction, idleFormActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
      setNotice({ kind: "success", message: text.supplierCreateSuccess });
      return;
    }

    if (state.status === "error") {
      setNotice({ kind: "error", message: text.supplierCreateError });
    }
  }, [router, state.status, text.supplierCreateError, text.supplierCreateSuccess]);

  return (
    <>
      <form ref={formRef} action={formAction} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.supplier}
          <input name="name" className="rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 transition focus:border-cyan-500" placeholder={text.enterSupplierName} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.contactPerson}
          <input name="contactName" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.contactPersonPlaceholder} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.phone}
            <input name="phone" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.phoneNumberPlaceholder} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.email}
            <input name="email" type="email" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.emailAddressPlaceholder} />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.address}
          <textarea name="address" className="min-h-28 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.basicSupplierAddressPlaceholder} />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input name="isActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
          {text.active}
        </label>
        <button type="submit" disabled={pending} className={`w-full sm:w-auto ${primaryActionButtonClass}`}>
          {pending ? text.submitting : text.submit}
        </button>
      </form>
      <ActionToast notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function SupplierUpdateForm({ supplier, text }: { supplier: SupplierRow; text: SupplierText }) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionNotice>(null);
  const [state, formAction, pending] = useActionState(updateSupplierAction, idleFormActionState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      setNotice({ kind: "success", message: text.supplierUpdateSuccess });
      return;
    }

    if (state.status === "error") {
      setNotice({ kind: "error", message: text.supplierUpdateError });
    }
  }, [router, state.status, text.supplierUpdateError, text.supplierUpdateSuccess]);

  return (
    <>
      <form action={formAction} className="grid gap-4 border-t border-slate-200 bg-slate-50 px-4 py-4">
        <input type="hidden" name="supplierId" value={supplier.id} />
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.supplier}
          <input name="name" defaultValue={supplier.name} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.contactPerson}
          <input name="contactName" defaultValue={supplier.contactName ?? ""} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.phone}
            <input name="phone" defaultValue={supplier.phone ?? ""} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.email}
            <input name="email" type="email" defaultValue={supplier.email ?? ""} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.address}
          <textarea name="address" defaultValue={supplier.address ?? ""} className="min-h-28 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          <input name="isActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked={supplier.isActive} />
          {text.active}
        </label>
        <button type="submit" disabled={pending} className={`sm:w-auto ${primaryActionButtonClass}`}>
          {pending ? text.submitting : text.updateSupplier}
        </button>
      </form>
      <ActionToast notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}