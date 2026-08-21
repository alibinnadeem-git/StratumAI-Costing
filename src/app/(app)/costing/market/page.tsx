import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { atLeast } from "@/lib/rbac";
import { createMarketFactorAction, deleteMarketFactorAction } from "../actions";

export default async function MarketIntelPage() {
  const ctx = await requireTenantContext();
  const canManage = atLeast(ctx.accountRole, "ADMIN");
  const factors = await db.marketFactor.findMany({ where: { accountId: ctx.account.id }, orderBy: [{ asOf: "desc" }, { createdAt: "desc" }] });

  return <div className="space-y-5">
    <section className="stratum-sheet"><h1 className="stratum-sheet-title">Market Intelligence</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · account pricing signals; no silent repricing</p></section>
    {canManage && <section className="stratum-sheet"><form action={createMarketFactorAction} className="grid gap-2 md:grid-cols-4"><input name="description" required placeholder="Signal description" className="md:col-span-2"/><input name="category" placeholder="Category"/><input name="asOf" type="date"/><select name="direction"><option value="INCREASE">Increase</option><option value="DECREASE">Decrease</option></select><input name="magnitude" type="number" step="0.01" placeholder="Magnitude %"/><select name="affects"><option value="ALL">All cost</option><option value="MATERIAL">Material</option><option value="LABOR">Labor</option></select><input name="source" placeholder="Source / citation"/><input name="url" placeholder="https://…" className="md:col-span-3"/><button className="btn">Add signal</button></form></section>}
    <section className="grid gap-3 md:grid-cols-2">{factors.map(factor=><div key={factor.id} className="stratum-sheet !mb-0"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-[9px] uppercase tracking-[0.07em] text-[#6D8AA0]">{factor.category} · {factor.affects}</div><h3 className="mt-1 text-sm font-semibold text-[#DCEBF5]">{factor.description}</h3></div><span className={`tag ${factor.direction === "INCREASE" ? "NECA" : "HIST"}`}>{factor.direction === "INCREASE" ? "+" : "−"}{factor.magnitude}%</span></div><p className="mt-3 text-xs leading-5 text-[#9FB6C7]">{factor.source||"No source note"}</p><div className="mt-3 flex items-center justify-between font-mono text-[10px]"><span className="text-[#6D8AA0]">As of {factor.asOf?.toISOString().slice(0,10)||"—"}</span><div className="flex gap-3">{factor.url&&<a href={factor.url} target="_blank" rel="noreferrer" className="text-[#6FD6C9]">Source ↗</a>}{canManage&&<form action={deleteMarketFactorAction}><input type="hidden" name="id" value={factor.id}/><button className="text-[#E0715C]">Delete</button></form>}</div></div></div>)}{factors.length===0&&<div className="empty-state md:col-span-2">No market signals configured for this account.</div>}</section>
  </div>;
}
