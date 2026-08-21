import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { atLeast } from "@/lib/rbac";
import { money } from "@/lib/costing";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { createCostItemAction, deleteCostItemAction, updateCostItemAction } from "../actions";

export default async function CostItemsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const ctx = await requireOrgContext();
  const canManage = atLeast(ctx.role, "ADMIN");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const category = (sp.category || "").trim();
  const where = {
    organizationId: ctx.organization.id,
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" as const } }, { category: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [items, categoryRows, settings] = await Promise.all([
    db.costItem.findMany({ where, orderBy: [{ category: "asc" }, { description: "asc" }], take: 500 }),
    db.costItem.findMany({ where: { organizationId: ctx.organization.id }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    db.costSettings.findUnique({ where: { organizationId: ctx.organization.id } }),
  ]);
  const laborRate = settings?.laborRate ?? 95;

  return <div className="space-y-5">
    <PageHeader eyebrow={ctx.organization.name} title="Item Database" subtitle="Organization-owned labor and material rates. Estimates snapshot these values when a line is added." actions={<Link href="/api/costing/items/csv" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export CSV</Link>} />

    {canManage && <Card className="p-4">
      <form action={createCostItemAction} className="grid gap-2 md:grid-cols-8">
        <input name="description" required placeholder="Description" className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="category" required placeholder="Category" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="unit" defaultValue="EA" placeholder="Unit" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="laborHoursPerUnit" type="number" step="0.001" defaultValue="0" placeholder="Labor hrs" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="materialCost" type="number" step="0.01" defaultValue="0" placeholder="Material $" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="source" defaultValue="MANUAL" className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option>MANUAL</option><option>NECA</option><option>REF</option><option>HIST</option><option>QUOTE</option></select>
        <button className="rounded-md bg-signal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-signal-700">Add item</button>
      </form>
    </Card>}

    <Card className="p-4">
      <form className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
        <input name="q" defaultValue={q} placeholder="Search description or category…" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="category" defaultValue={category} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All categories</option>{categoryRows.map(c=><option key={c.category}>{c.category}</option>)}</select>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Filter</button>
      </form>
    </Card>

    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead><tr className="border-b bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">Description</th><th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5">Unit</th><th className="px-3 py-2.5 text-right">Labor hrs</th><th className="px-3 py-2.5 text-right">Material</th><th className="px-3 py-2.5 text-right">Working cost</th><th className="px-3 py-2.5">Source</th>{canManage&&<th/>}</tr></thead>
          <tbody>{items.map(item => {
            const unitCost = item.materialCost + item.laborHoursPerUnit * laborRate;
            return <tr key={item.id} className="border-b border-slate-100 last:border-0 align-top">
              {canManage ? <>
                <td className="px-3 py-2"><form id={`f-${item.id}`} action={updateCostItemAction}><input type="hidden" name="id" value={item.id}/><input name="description" defaultValue={item.description} className="w-full min-w-[280px] rounded border border-slate-200 px-2 py-1.5"/></form></td>
                <td className="px-3 py-2"><input form={`f-${item.id}`} name="category" defaultValue={item.category} className="w-36 rounded border border-slate-200 px-2 py-1.5"/></td>
                <td className="px-3 py-2"><input form={`f-${item.id}`} name="unit" defaultValue={item.unit} className="w-16 rounded border border-slate-200 px-2 py-1.5"/></td>
                <td className="px-3 py-2"><input form={`f-${item.id}`} name="laborHoursPerUnit" type="number" step="0.001" defaultValue={item.laborHoursPerUnit} className="w-24 rounded border border-slate-200 px-2 py-1.5 text-right font-mono"/></td>
                <td className="px-3 py-2"><input form={`f-${item.id}`} name="materialCost" type="number" step="0.01" defaultValue={item.materialCost} className="w-28 rounded border border-slate-200 px-2 py-1.5 text-right font-mono"/></td>
              </> : <>
                <td className="px-3 py-2 font-medium text-slate-800">{item.description}{item.necaVerified&&<div className="mt-1 text-[10px] font-semibold text-amber-600">VERIFIED NECA · PDF P.{item.necaSourcePage}</div>}</td>
                <td className="px-3 py-2 text-slate-500">{item.category}</td><td className="px-3 py-2 font-mono text-xs">{item.unit}</td><td className="px-3 py-2 text-right font-mono">{item.laborHoursPerUnit.toFixed(3)}</td><td className="px-3 py-2 text-right font-mono">{money(item.materialCost)}</td>
              </>}
              <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{money(unitCost)}</td>
              <td className="px-3 py-2">{canManage ? <select form={`f-${item.id}`} name="source" defaultValue={item.source} className="rounded border border-slate-200 px-2 py-1.5 text-xs"><option>MANUAL</option><option>NECA</option><option>REF</option><option>HIST</option><option>QUOTE</option></select> : <span className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">{item.source}</span>}</td>
              {canManage&&<td className="px-3 py-2 whitespace-nowrap"><button form={`f-${item.id}`} className="mr-2 text-xs font-semibold text-signal-600">Save</button><form action={deleteCostItemAction} className="inline"><input type="hidden" name="id" value={item.id}/><button className="text-xs font-semibold text-rose-600">Delete</button></form></td>}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {items.length===500 && <div className="border-t bg-amber-50 px-4 py-2 text-xs text-amber-700">Showing first 500 matches. Narrow the filter for faster catalog work.</div>}
    </Card>
  </div>;
}
