import { InboundBatchEditor } from "@/components/inbound-batch-editor";
import { requireUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";
import { getInboundProductOptions, getInboundRows } from "@/lib/warehouse-data";

export default async function InboundPage() {
  await requireUser();

  const [inboundRows, products, { text }] = await Promise.all([getInboundRows(), getInboundProductOptions(), getUiContext()]);

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">{text.inboundReceiving}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{text.receiveIntoKhoTong}</h1>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[720px] divide-y divide-slate-200 text-left text-sm lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{text.product}</th>
                <th className="px-4 py-3 font-medium">{text.supplier}</th>
                <th className="px-4 py-3 font-medium">{text.quantity}</th>
                <th className="px-4 py-3 font-medium">{text.note}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {inboundRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                    {text.noInboundRows}
                  </td>
                </tr>
              ) : inboundRows.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{line.product}</td>
                  <td className="px-4 py-3 text-slate-600">{line.supplier}</td>
                  <td className="px-4 py-3 text-slate-600">{line.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{line.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">{text.addInboundBatch}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">{text.multiLineForm}</h2>
        <div className="mt-5">
          <InboundBatchEditor products={products} text={text} />
        </div>
      </section>
    </div>
  );
}
