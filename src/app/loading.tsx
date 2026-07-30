export default function Loading() {
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}