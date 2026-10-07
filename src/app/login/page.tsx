import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions/auth";
import { LoginSubmitButton } from "@/components/login-submit-button";
import { getCurrentUser } from "@/lib/auth";
import { uiText as text } from "@/lib/ui";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string; passwordChanged?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const error = params.error === "missing" ? text.loginMissing : params.error === "invalid" ? text.loginInvalid : null;

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-cyan-950/10 sm:p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-700">SAGOKE TRADING</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-950">{text.loginTitle}</h1>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {!error && params.passwordChanged === "1" ? (
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{text.passwordChanged}</p>
      ) : null}
      <form action={loginAction} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.username}
          <input
            name="username"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500"
            placeholder={text.username}
            autoComplete="username"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {text.password}
          <input
            name="password"
            type="password"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500"
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
