import { requireOrgContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createSupplierAction, deleteSupplierAction } from "./actions";

export default async function SuppliersPage() {
  const ctx = await requireOrgContext();
  const canManage = can.manageSuppliers(ctx.role);

  const suppliers = await db.supplier.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Suppliers</h1>
        <p className="text-sm text-slate-500">Vendor directory used when sending RFQs from a project takeoff.</p>
      </div>

      {canManage && (
        <form action={createSupplierAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/80 bg-white shadow-card p-4">
          <F label="Supplier name"><input name="name" required placeholder="Graybar" className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm" /></F>
          <F label="Contact name"><input name="contactName" placeholder="Jordan" className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" /></F>
          <F label="Email"><input name="email" type="email" required placeholder="quotes@graybar.com" className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm" /></F>
          <F label="Phone"><input name="phone" placeholder="(510) 555-0101" className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" /></F>
          <F label="Categories"><input name="categories" placeholder="lighting, conduit" className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm" /></F>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98]">+ Add supplier</button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Contact</th>
              <th className="px-4 py-2.5 font-semibold">Email</th>
              <th className="px-4 py-2.5 font-semibold">Categories</th>
              <th className="px-4 py-2.5 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{s.contactName || "—"}{s.phone ? ` · ${s.phone}` : ""}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.email}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {s.categories.map((c) => (
                      <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{c}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {canManage && (
                    <form action={async () => { "use server"; await deleteSupplierAction(s.id); }}>
                      <button className="text-xs font-semibold text-rose-600 hover:text-rose-700">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No suppliers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
