import Link from "next/link";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";

export default async function EstimatesPage() {
  const ctx = await requireTenantContext();
  const estimates = await db.costEstimate.findMany({
    where: { accountId: ctx.account.id },
    include: { lineItems: true, adders: true, project: true, createdBy: { select: { name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  return <div className="space-y-5">
    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="stratum-sheet-title">Estimate Builder</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · account-scoped estimating</p></div><Link href="/costing/estimates/new" className="btn">New estimate</Link></div></section>
    <section className="stratum-sheet"><div className="table-scroll"><table className="min-w-[800px]"><thead><tr><th>Estimate</th><th>Project</th><th>Status</th><th>Condition</th><th>Updated</th><th className="num">Price</th></tr></thead><tbody>{estimates.map((estimate) => {
      const total = calculateEstimate({ lines: estimate.lineItems, adders: estimate.adders, laborRate: estimate.laborRate, overheadPercent: estimate.overheadPercent, profitMarginPercent: estimate.profitMarginPercent, difficultyMultiplier: estimate.difficultyMultiplier, condition: estimate.condition }).total;
      return <tr key={estimate.id}><td className="desc-cell"><Link href={`/costing/estimates/${estimate.id}`} className="text-[#DCEBF5] hover:text-[#E0954F]">EST-{String(estimate.number).padStart(4, "0")} · {estimate.name}</Link><span className="cat">{estimate.lineItems.length} line{estimate.lineItems.length === 1 ? "" : "s"} · {estimate.createdBy?.name || estimate.createdBy?.email || "—"}</span></td><td>{estimate.project?.name || "—"}</td><td><span className="tag REF">{estimate.status}</span></td><td>{estimate.condition.replaceAll("_", " ")}</td><td>{estimate.updatedAt.toISOString().slice(0, 10)}</td><td className="num text-[#6FD6C9]">{money(total)}</td></tr>;
    })}</tbody></table></div>{estimates.length === 0 && <div className="empty-state mt-3">No estimates in this account yet.</div>}</section>
  </div>;
}
