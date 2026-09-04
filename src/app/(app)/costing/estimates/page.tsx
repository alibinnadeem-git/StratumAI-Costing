import Link from "next/link";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";

const CONTROLLED = new Set(["SUBMITTED", "AWARDED", "LOST", "ARCHIVED"]);

export default async function EstimatesPage() {
  const ctx = await requireTenantContext();
  const estimates = await db.costEstimate.findMany({
    where: { accountId: ctx.account.id },
    include: { lineItems: true, adders: true, project: true, createdBy: { select: { name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  return <div className="space-y-5">
    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="stratum-sheet-title">Estimate Builder</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · account-scoped estimating</p><p className="mt-2 text-xs text-[#8FA8B8]">Submitted and closed commercial estimates are protected. Use Create revision to continue work without changing the original snapshot.</p></div><Link href="/costing/estimates/new" className="btn">New estimate</Link></div></section>
    <section className="stratum-sheet"><div className="table-scroll"><table className="min-w-[1040px]"><thead><tr><th>Estimate</th><th>Project</th><th>Status</th><th>Condition</th><th>Updated</th><th className="num">Price</th><th>Actions</th></tr></thead><tbody>{estimates.map((estimate) => {
      const total = calculateEstimate({ lines: estimate.lineItems, adders: estimate.adders, laborRate: estimate.laborRate, overheadPercent: estimate.overheadPercent, profitMarginPercent: estimate.profitMarginPercent, difficultyMultiplier: estimate.difficultyMultiplier, condition: estimate.condition }).total;
      const controlled = CONTROLLED.has(estimate.status);
      return <tr key={estimate.id}><td className="desc-cell"><Link href={`/costing/estimates/${estimate.id}`} className="text-[#DCEBF5] hover:text-[#E0954F]">EST-{String(estimate.number).padStart(4, "0")} · {estimate.name}</Link><span className="cat">{estimate.lineItems.length} line{estimate.lineItems.length === 1 ? "" : "s"} · {estimate.createdBy?.name || estimate.createdBy?.email || "—"}</span></td><td>{estimate.project?.name || "—"}</td><td><span className="tag REF">{estimate.status}</span>{controlled && <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[#E0954F]">Protected</span>}</td><td>{estimate.condition.replaceAll("_", " ")}</td><td>{estimate.updatedAt.toISOString().slice(0, 10)}</td><td className="num text-[#6FD6C9]">{money(total)}</td><td><div className="flex flex-wrap gap-x-3 gap-y-1"><Link href={`/costing/estimates/${estimate.id}/health`} className="text-xs font-semibold text-[#9CB2C2] hover:text-[#DCEBF5]">Health</Link>{estimate.projectId && <Link href={`/costing/estimates/${estimate.id}/rfq`} className="text-xs font-semibold text-amber-300 hover:text-amber-200">Build RFQ</Link>}{controlled ? <Link href={`/costing/estimates/${estimate.id}/revision`} className="text-xs font-semibold text-[#E0954F] hover:text-[#F0B06E]">Create revision</Link> : <Link href={`/costing/estimates/${estimate.id}`} className="text-xs font-semibold text-[#6FD6C9] hover:text-[#A9E8DF]">Edit</Link>}</div></td></tr>;
    })}</tbody></table></div>{estimates.length === 0 && <div className="empty-state mt-3">No estimates in this account yet.</div>}</section>
  </div>;
}
