"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserRole } from "@prisma/client";
import { useRouter } from "next/navigation";

import { createUserAction, resetUserPasswordAction } from "@/app/actions/warehouse";
import { ActionToast, primaryActionButtonClass, secondaryActionButtonClass, type ActionNotice } from "@/components/action-feedback";
import { idleFormActionState } from "@/lib/action-state";

type ManageUserText = {
  username: string;
  password: string;
  role: string;
  admin: string;
  operation: string;
  submit: string;
  submitting: string;
  loginIdPlaceholder: string;
  temporaryPasswordPlaceholder: string;
  newPasswordPlaceholder: string;
  resetPassword: string;
  resetPasswordButton: string;
  usernameTaken: string;
  userCreateSuccess: string;
  userCreateError: string;
  passwordResetSuccess: string;
  passwordResetError: string;
};

export function CreateUserForm({ text }: { text: ManageUserText }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<ActionNotice>(null);
  const [state, formAction, pending] = useActionState(createUserAction, idleFormActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
      setNotice({ kind: "success", message: text.userCreateSuccess });
      return;
    }

    if (state.status === "error") {
      setNotice({
        kind: "error",
        message: state.message === "username-taken" ? text.usernameTaken : text.userCreateError,
      });
    }
  }, [router, state.message, state.status, text.userCreateError, text.userCreateSuccess, text.usernameTaken]);

  return (
    <>
      <form ref={formRef} action={formAction} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.username}
          <input name="username" minLength={3} autoComplete="username" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.loginIdPlaceholder} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.password}
          <input name="password" type="password" autoComplete="new-password" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder={text.temporaryPasswordPlaceholder} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.role}
          <select name="role" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" defaultValue={UserRole.OPERATION}>
            <option value={UserRole.ADMIN}>{text.admin}</option>
            <option value={UserRole.OPERATION}>{text.operation}</option>
          </select>
        </label>
        <button type="submit" disabled={pending} className={primaryActionButtonClass}>
          {pending ? text.submitting : text.submit}
        </button>
      </form>
      <ActionToast notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function ResetPasswordForm({ text, userId }: { text: ManageUserText; userId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<ActionNotice>(null);
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, idleFormActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
      setNotice({ kind: "success", message: text.passwordResetSuccess });
      return;
    }

    if (state.status === "error") {
      setNotice({ kind: "error", message: text.passwordResetError });
    }
  }, [router, state.status, text.passwordResetError, text.passwordResetSuccess]);

  return (
    <>
      <form ref={formRef} action={formAction} className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
        <input type="hidden" name="userId" value={userId} />
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.resetPassword}
          <input
            name="password"
            type="password"
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
            placeholder={text.newPasswordPlaceholder}
          />
        </label>
        <button type="submit" disabled={pending} className={secondaryActionButtonClass}>
          {pending ? text.submitting : text.resetPasswordButton}
        </button>
      </form>
      <ActionToast notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}