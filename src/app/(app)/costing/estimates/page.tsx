import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";
import { Card, PageHeader } from "@/components/ui";

export default async function EstimatesPage() {
  const ctx = await requireOrgContext();
  const estimates = await db.costEstimate.findMany({ where: { organizationId: ctx.organization.id }, include: { lineItems: true, adders: true, project: true, createdBy: { select: { name:true,email:true } } }, orderBy: { updatedAt: "desc" }, take: 250 });
  return <div className="space-y-5">
    <PageHeader eyebrow={ctx.organization.name} title="Estimates" subtitle="Every estimate is tenant-scoped and snapshots its rates, labor settings and line-item values." actions={<Link href="/costing/estimates/new" className="rounded-lg bg-signal-600 px-3.5 py-2 text-xs font-semibold text-white">New estimate</Link>} />
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="min-w-[800px] w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-2.5">Estimate</th><th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Condition</th><th className="px-4 py-2.5">Updated</th><th className="px-4 py-2.5 text-right">Price</th></tr></thead><tbody>{estimates.map(e=>{
      const total=calculateEstimate({lines:e.lineItems,adders:e.adders,laborRate:e.laborRate,overheadPercent:e.overheadPercent,profitMarginPercent:e.profitMarginPercent,difficultyMultiplier:e.difficultyMultiplier,condition:e.condition}).total;
      return <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="px-4 py-3"><Link href={`/costing/estimates/${e.id}`} className="font-semibold text-slate-800 hover:text-signal-600">EST-{String(e.number).padStart(4,"0")} · {e.name}</Link><div className="text-xs text-slate-400">{e.lineItems.length} line{e.lineItems.length===1?"":"s"} · {e.createdBy?.name||e.createdBy?.email||"—"}</div></td><td className="px-4 py-3 text-slate-500">{e.project?.name||"—"}</td><td className="px-4 py-3 text-xs font-semibold text-slate-500">{e.status}</td><td className="px-4 py-3 text-xs text-slate-500">{e.condition.replaceAll("_"," ")}</td><td className="px-4 py-3 text-xs text-slate-400">{e.updatedAt.toLocaleDateString()}</td><td className="px-4 py-3 text-right font-mono font-semibold">{money(total)}</td></tr>})}</tbody></table></div>{estimates.length===0&&<div className="p-10 text-center text-sm text-slate-400">No estimates created yet.</div>}</Card>
  </div>;
}
