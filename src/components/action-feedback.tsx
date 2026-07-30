"use client";

import { useEffect } from "react";

export type ActionNotice = {
  kind: "success" | "error";
  message: string;
} | null;

export const primaryActionButtonClass = "rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white/90";

export const secondaryActionButtonClass = "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70";

export function ActionToast({
  notice,
  onClose,
}: {
  notice: ActionNotice;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(onClose, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [notice, onClose]);

  if (!notice) {
    return null;
  }

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl">
      <div className={`text-sm font-medium ${notice.kind === "success" ? "text-emerald-700" : "text-rose-700"}`}>
        {notice.message}
      </div>
    </div>
  );
}