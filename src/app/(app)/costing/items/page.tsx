import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { atLeast } from "@/lib/rbac";
import { money } from "@/lib/costing";
import Link from "next/link";
import { createCostItemAction, deleteCostItemAction, updateCostItemAction } from "../actions";

export default async function CostItemsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const ctx = await requireTenantContext();
  const canManage = atLeast(ctx.accountRole, "ADMIN");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const category = (sp.category || "").trim();
  const where = {
    accountId: ctx.account.id,
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" as const } }, { category: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [items, categoryRows, settings] = await Promise.all([
    db.costItem.findMany({ where, orderBy: [{ category: "asc" }, { description: "asc" }], take: 500 }),
    db.costItem.findMany({ where: { accountId: ctx.account.id }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    db.costSettings.findUnique({ where: { accountId: ctx.account.id } }),
  ]);
  const laborRate = settings?.laborRate ?? 95;

  return <div className="space-y-5">
    <section className="stratum-sheet">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="stratum-sheet-title">Item Database</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · account-owned labor and material rates</p></div>
        <Link href="/api/costing/items/csv" className="btn secondary small">Export CSV</Link>
      </div>
      {canManage && <form action={createCostItemAction} className="mt-4 grid gap-2 border-t border-[#1C3A57] pt-4 md:grid-cols-8">
        <input name="description" required placeholder="Description" className="md:col-span-2" />
        <input name="category" required placeholder="Category" />
        <input name="unit" defaultValue="EA" placeholder="Unit" />
        <input name="laborHoursPerUnit" type="number" step="0.001" defaultValue="0" placeholder="Labor hrs" />
        <input name="materialCost" type="number" step="0.01" defaultValue="0" placeholder="Material $" />
        <select name="source" defaultValue="MANUAL"><option>MANUAL</option><option>NECA</option><option>REF</option><option>HIST</option><option>QUOTE</option></select>
        <button className="btn">Add item</button>
      </form>}
    </section>

    <section className="stratum-sheet">
      <form className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
        <input name="q" defaultValue={q} placeholder="Search description or category…" />
        <select name="category" defaultValue={category}><option value="">All categories</option>{categoryRows.map(c=><option key={c.category}>{c.category}</option>)}</select>
        <button className="btn secondary">Filter</button>
      </form>
    </section>

    <section className="stratum-sheet">
      <div className="table-scroll">
        <table className="min-w-[980px]">
          <thead><tr><th>Description</th><th>Category</th><th>Unit</th><th className="num">Labor hrs</th><th className="num">Material</th><th className="num">Working cost</th><th>Source</th>{canManage&&<th/>}</tr></thead>
          <tbody>{items.map(item => {
            const unitCost = item.materialCost + item.laborHoursPerUnit * laborRate;
            return <tr key={item.id} className="align-top">
              {canManage ? <>
                <td><form id={`f-${item.id}`} action={updateCostItemAction}><input type="hidden" name="id" value={item.id}/><input name="description" defaultValue={item.description} className="min-w-[280px]"/></form></td>
                <td><input form={`f-${item.id}`} name="category" defaultValue={item.category}/></td>
                <td><input form={`f-${item.id}`} name="unit" defaultValue={item.unit}/></td>
                <td><input form={`f-${item.id}`} name="laborHoursPerUnit" type="number" step="0.001" defaultValue={item.laborHoursPerUnit}/></td>
                <td><input form={`f-${item.id}`} name="materialCost" type="number" step="0.01" defaultValue={item.materialCost}/></td>
              </> : <>
                <td className="desc-cell">{item.description}{item.necaVerified&&<span className="cat text-[#E0954F]">VERIFIED NECA · PDF P.{item.necaSourcePage}</span>}</td>
                <td>{item.category}</td><td>{item.unit}</td><td className="num">{item.laborHoursPerUnit.toFixed(3)}</td><td className="num">{money(item.materialCost)}</td>
              </>}
              <td className="num text-[#6FD6C9]">{money(unitCost)}</td>
              <td>{canManage ? <select form={`f-${item.id}`} name="source" defaultValue={item.source}><option>MANUAL</option><option>NECA</option><option>REF</option><option>HIST</option><option>QUOTE</option></select> : <span className={`tag ${item.source}`}>{item.source}</span>}</td>
              {canManage&&<td className="whitespace-nowrap"><button form={`f-${item.id}`} className="btn small mr-2">Save</button><form action={deleteCostItemAction} className="inline"><input type="hidden" name="id" value={item.id}/><button className="btn danger small">Delete</button></form></td>}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {items.length === 0 && <div className="empty-state mt-3">No matching items in this account.</div>}
      {items.length===500 && <div className="banner mt-3">Showing first 500 matches. Narrow the filter for faster catalog work.</div>}
    </section>
  </div>;
}
