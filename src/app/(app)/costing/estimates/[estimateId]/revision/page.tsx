import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { money, calculateEstimate } from "@/lib/costing";
import { createEstimateRevisionAction } from "./actions";

const CONTROLLED = new Set(["SUBMITTED", "AWARDED", "LOST", "ARCHIVED"]);

export default async function EstimateRevisionPage({ params }: { params: Promise<{ estimateId: string }> }) {
  const { estimateId } = await params;
  const ctx = await requireTenantContext();
  const estimate = await db.costEstimate.findFirst({
    where: { id: estimateId, accountId: ctx.account.id },
    include: { lineItems: true, adders: true, project: true },
  });
  if (!estimate) notFound();

  const total = calculateEstimate({
    lines: estimate.lineItems,
    adders: estimate.adders,
    laborRate: estimate.laborRate,
    overheadPercent: estimate.overheadPercent,
    profitMarginPercent: estimate.profitMarginPercent,
    difficultyMultiplier: estimate.difficultyMultiplier,
    condition: estimate.condition,
  }).total;

  return <div className="space-y-5">
    <section className="stratum-sheet">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Commercial Control · Estimate Revision</p>
          <h1 className="stratum-sheet-title">Create Draft Revision</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#9CB2C2]">Create a new editable estimate from the current commercial snapshot. The source estimate remains unchanged and traceable.</p>
        </div>
        <Link href={`/costing/estimates/${estimate.id}`} className="btn-secondary">Back to estimate</Link>
      </div>
    </section>

    <section className="stratum-sheet space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div><span className="cat">Source</span><div className="mt-1 text-[#DCEBF5]">EST-{String(estimate.number).padStart(4, "0")}</div></div>
        <div><span className="cat">Status</span><div className="mt-1"><span className="tag REF">{estimate.status}</span></div></div>
        <div><span className="cat">Lines</span><div className="mt-1 text-[#DCEBF5]">{estimate.lineItems.length}</div></div>
        <div><span className="cat">Current price</span><div className="mt-1 font-mono text-[#6FD6C9]">{money(total)}</div></div>
      </div>

      <div className="rounded-xl border border-[#294356] bg-[#0C1720] p-4 text-sm text-[#AFC3D0]">
        {CONTROLLED.has(estimate.status)
          ? "This estimate is controlled. Its commercial header, line items, adders, and deletion are protected. The new revision will be created in DRAFT status with cloned line-item and adder snapshots."
          : "This estimate is still editable, but you can create a separate revision snapshot when you want to preserve the current version before making changes."}
      </div>

      <form action={createEstimateRevisionAction} className="allow-controlled-action">
        <input type="hidden" name="estimateId" value={estimate.id} />
        <button className="btn">Create draft revision</button>
      </form>
    </section>
  </div>;
}
