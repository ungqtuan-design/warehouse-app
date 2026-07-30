import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";

export default async function LoginPage() {
  const [user, { text }] = await Promise.all([getCurrentUser(), getUiContext()]);

  if (user) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Wiings</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">{text.loginTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {text.loginBody}
      </p>
      <form action={loginAction} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          {text.username}
          <input
            name="username"
            defaultValue="admin"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder="admin"
            autoComplete="username"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          {text.password}
          <input
            name="password"
            type="password"
            defaultValue="admin"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder={text.password}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="mt-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
          {text.signIn}
        </button>
      </form>
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 text-sm text-slate-300">
        {text.defaultAdmin}: <span className="font-semibold text-white">admin / admin</span>
      </div>
    </div>
  );
}
