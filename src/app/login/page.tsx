import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions/auth";
import { LoginSubmitButton } from "@/components/login-submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";

export default async function LoginPage() {
  const [user, { text }] = await Promise.all([getCurrentUser(), getUiContext()]);

  if (user) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">MIMS</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">{text.loginTitle}</h1>
      <form action={loginAction} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          {text.username}
          <input
            name="username"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder={text.username}
            autoComplete="username"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          {text.password}
          <input
            name="password"
            type="password"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder={text.password}
            autoComplete="current-password"
            required
          />
        </label>
        <LoginSubmitButton label={text.signIn} pendingLabel={text.signingIn} />
      </form>
    </div>
  );
}
