import Link from "next/link";
import { requireTenantContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createSupplierAction, deleteSupplierAction } from "./actions";

export default async function SuppliersPage() {
  const ctx = await requireTenantContext();
  const canManage = can.manageSuppliers(ctx.accountRole);

  const suppliers = await db.supplier.findMany({
    where: { accountId: ctx.account.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-5">
      <section className="stratum-sheet">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="stratum-sheet-title">Suppliers</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">
              {ctx.organization.name} · {ctx.account.name} · vendor directory and RFQ sourcing
            </p>
          </div>
          <Link href="/suppliers/lead-times" className="btn-secondary">Lead-time intelligence</Link>
        </div>

        {canManage && (
          <form action={createSupplierAction} className="grid gap-3 border-t border-[#1C3A57] pt-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end">
            <F label="Supplier name"><input name="name" required placeholder="Graybar" /></F>
            <F label="Contact name"><input name="contactName" placeholder="Jordan" /></F>
            <F label="Email"><input name="email" type="email" required placeholder="quotes@vendor.com" /></F>
            <F label="Phone"><input name="phone" placeholder="(510) 555-0101" /></F>
            <F label="Categories"><input name="categories" placeholder="lighting, conduit" /></F>
            <button className="btn h-[35px]">+ Add supplier</button>
          </form>
        )}
      </section>

      <section className="stratum-sheet">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Categories</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="font-medium text-[#DCEBF5]">{supplier.name}</td>
                  <td>{supplier.contactName || "—"}{supplier.phone ? ` · ${supplier.phone}` : ""}</td>
                  <td className="text-[#9FB6C7]">{supplier.email}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {supplier.categories.map((category) => (
                        <span key={category} className="tag QUOTE">{category}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right">
                    {canManage && (
                      <form action={async () => { "use server"; await deleteSupplierAction(supplier.id); }}>
                        <button className="btn danger small">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {suppliers.length === 0 && <div className="empty-state mt-3">No suppliers in this account yet.</div>}
      </section>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label>{label}{children}</label>;
}
