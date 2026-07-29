export default function Home() {
  const metrics = [
    { label: "Total products", value: "128", note: "Active and obsolete catalog" },
    { label: "Low stock items", value: "14", note: "Prioritized by 30-day outbound" },
    { label: "Open inbound lines", value: "23", note: "Pending manufacturer receipts" },
    { label: "Basket value", value: "8 items", note: "Ready to issue from kho le" },
  ];

  const flows = [
    "Manufacturer -> kho tong",
    "kho tong -> kho le",
    "kho le -> customer",
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Dashboard</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Warehouse flows are constrained by location rules, not spreadsheet edits.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              This MVP is structured around transaction history so stock is derived from valid movements instead of direct quantity edits.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm font-semibold text-slate-200">Allowed stock flow</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {flows.map((flow) => (
                <li key={flow} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                  {flow}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{metric.value}</p>
            <p className="mt-2 text-sm text-slate-600">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Implementation focus</h3>
              <p className="text-sm text-slate-500">What this first code pass is wiring up</p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Area</th>
                  <th className="px-4 py-3 font-medium">Intent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="px-4 py-3 font-medium">Suppliers</td>
                  <td className="px-4 py-3 text-slate-600">Basic supplier master data and product linkage</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Products</td>
                  <td className="px-4 py-3 text-slate-600">Auto SKU, obsolete toggle, active filter, image metadata</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Inbound</td>
                  <td className="px-4 py-3 text-slate-600">Multi-line receive into kho tong only</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Inventory</td>
                  <td className="px-4 py-3 text-slate-600">Total stock, low-stock ranking, 30-day outbound signal</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Next backend steps</h3>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="rounded-xl bg-slate-50 px-4 py-3">Create Prisma schema and seed fixed locations.</li>
            <li className="rounded-xl bg-slate-50 px-4 py-3">Build supplier and product forms against Neon.</li>
            <li className="rounded-xl bg-slate-50 px-4 py-3">Store inventory as immutable transactions.</li>
            <li className="rounded-xl bg-slate-50 px-4 py-3">Rank inventory by low total stock and outbound pressure.</li>
          </ol>
        </article>
      </section>
    </div>
  );
}
