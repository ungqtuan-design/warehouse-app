"use client";

import { useActionState } from "react";

import { changePasswordAction } from "@/app/actions/auth";
import { primaryActionButtonClass } from "@/components/action-feedback";
import { idleFormActionState } from "@/lib/action-state";

type ChangePasswordText = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  changePassword: string;
  changingPassword: string;
};

export function ChangePasswordForm({ text }: { text: ChangePasswordText }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, idleFormActionState);
  const inputClass = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500";

  return (
    <form action={formAction} className="mt-6 grid gap-4" aria-busy={pending}>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        {text.currentPassword}
        <input name="currentPassword" type="password" autoComplete="current-password" required disabled={pending} className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        {text.newPassword}
        <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required disabled={pending} className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        {text.confirmPassword}
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={pending} className={inputClass} />
      </label>
      {state.status === "error" ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{state.message}</p> : null}
      <button type="submit" disabled={pending} className={primaryActionButtonClass}>
        {pending ? text.changingPassword : text.changePassword}
      </button>
    </form>
  );
}
