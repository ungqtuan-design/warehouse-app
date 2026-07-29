import { getSuppliers } from "@/lib/warehouse-data";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Supplier master</p>
            <h1 className="text-2xl font-semibold text-slate-950">Suppliers</h1>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            Basic fields only
          </span>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No suppliers in Neon yet.
                  </td>
                </tr>
              ) : suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{supplier.name}</div>
                    <div className="text-xs text-slate-500">{supplier.address}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{supplier.contactName}</td>
                  <td className="px-4 py-3 text-slate-600">{supplier.email}</td>
                  <td className="px-4 py-3 text-slate-600">{supplier.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${supplier.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {supplier.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Create new supplier</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Supplier form</h2>
        <form className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Supplier name
            <input className="rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 transition focus:border-cyan-500" placeholder="Enter supplier name" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Contact person
            <input className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Contact person" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Phone
              <input className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Phone number" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Email
              <input className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Email address" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Address
            <textarea className="min-h-28 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Basic supplier address" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
            Active supplier
          </label>
          <button type="button" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Save supplier
          </button>
        </form>
      </section>
    </div>
  );
}
