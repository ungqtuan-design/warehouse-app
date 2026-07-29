import { basketDraftLines } from "@/lib/mock-data";

export default function BasketPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Outbound basket</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Issue from kho le</h1>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Available</th>
                <th className="px-4 py-3 font-medium">Quantity</th>
                <th className="px-4 py-3 font-medium">Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {basketDraftLines.map((line) => (
                <tr key={line.sku}>
                  <td className="px-4 py-3 font-medium text-slate-900">{line.sku}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{line.product}</div>
                    <div className="text-xs text-slate-500">Source: {line.source}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{line.available}</td>
                  <td className="px-4 py-3 text-slate-600">{line.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{line.customer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Checkout basket</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Customer issue</h2>
        <form className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Customer name
            <input className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Customer or line name" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Reference number
            <input className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500" placeholder="Delivery or issue reference" />
          </label>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Submission should create CUSTOMER_OUT transactions and reject any quantity that would push kho le below zero.
          </div>
          <button type="button" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Confirm issue
          </button>
        </form>
      </section>
    </div>
  );
}
