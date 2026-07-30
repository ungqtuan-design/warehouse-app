import { UserRole } from "@prisma/client";

import { createUserAction } from "@/app/actions/warehouse";
import { getRoleLabel, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUiContext } from "@/lib/ui";

export default async function ManageUsersPage() {
  await requireAdmin();
  const { text } = await getUiContext();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{text.adminOnly}</p>
            <h1 className="text-2xl font-semibold text-slate-950">{text.manageUsersTitle}</h1>
          </div>
          <div className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900">
            {text.admin} / {text.operation}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {users.map((user) => (
            <article key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">{user.name}</h2>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.role === UserRole.ADMIN ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {getRoleLabel(user.role)}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm text-slate-600">
                <div>
                  <dt className="font-medium text-slate-500">Email</dt>
                  <dd>{user.email ?? "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">{text.created}</dt>
                  <dd>{user.createdAt.toLocaleDateString()}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">{text.createUser}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">{text.manageUsersTitle}</h2>
        <form action={createUserAction} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.fullName}
            <input name="name" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="User display name" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.username}
            <input name="username" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="login id" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.password}
            <input name="password" type="password" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Temporary password" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.email}
            <input name="email" type="email" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="optional@email.com" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.role}
            <select name="role" className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" defaultValue={UserRole.OPERATION}>
              <option value={UserRole.ADMIN}>{text.admin}</option>
              <option value={UserRole.OPERATION}>{text.operation}</option>
            </select>
          </label>
          <button type="submit" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            {text.saveUser}
          </button>
        </form>
      </section>
    </div>
  );
}
