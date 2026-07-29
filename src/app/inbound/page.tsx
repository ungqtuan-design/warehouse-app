import { getInboundRows } from "@/lib/warehouse-data";

export default async function InboundPage() {
  const inboundRows = await getInboundRows();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Inbound receiving</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Receive into kho tong</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          For MVP, manufacturer receipts can only increase stock in kho tong. Multiple lines can be submitted together.
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {inboundRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No manufacturer receipts in Neon yet.
                  </td>
                </tr>
              ) : inboundRows.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{line.product}</td>
                  <td className="px-4 py-3 text-slate-600">{line.supplier}</td>
                  <td className="px-4 py-3 text-slate-600">{line.quantity}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">{line.destination}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{line.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Add inbound batch</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Multi-line form</h2>
        <form className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Reference number
            <input className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Manufacturer shipment reference" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Destination
            <input className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-500" value="kho tong" readOnly />
          </label>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Each line will map to one MANUFACTURER_IN transaction. Inactive or obsolete products should be blocked by backend validation.
          </div>
          <button type="button" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Submit inbound batch
          </button>
        </form>
      </section>
    </div>
  );
}
