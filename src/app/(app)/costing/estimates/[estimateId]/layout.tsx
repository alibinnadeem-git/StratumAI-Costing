import Link from "next/link";
import type { EstimateStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { changeEstimateStatusAction } from "./workflow-actions";

const CONTROLLED = new Set<EstimateStatus>(["APPROVED", "SUBMITTED", "AWARDED", "LOST", "SUPERSEDED", "ARCHIVED"]);
const NEXT: Record<EstimateStatus, EstimateStatus[]> = {
  DRAFT: ["REVIEW", "ARCHIVED"],
  REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["SUBMITTED", "SUPERSEDED", "ARCHIVED"],
  SUBMITTED: ["AWARDED", "LOST", "SUPERSEDED", "ARCHIVED"],
  AWARDED: ["ARCHIVED"],
  LOST: ["ARCHIVED"],
  SUPERSEDED: ["ARCHIVED"],
  ARCHIVED: [],
};

export default async function EstimateLayout({ children, params }: { children: React.ReactNode; params: Promise<{ estimateId: string }> }) {
  const { estimateId } = await params;
  const ctx = await requireTenantContext();
  const estimate = await db.costEstimate.findFirst({
    where: { id: estimateId, accountId: ctx.account.id },
    select: { id: true, number: true, status: true },
  });
  const controlled = !!estimate && CONTROLLED.has(estimate.status);
  const nextStatuses = estimate ? NEXT[estimate.status] : [];

  return <div className={controlled ? "controlled-estimate" : undefined}>
    {estimate && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2"><Link href={`/costing/estimates/${estimate.id}`} className="btn-secondary">Estimate</Link><Link href={`/costing/estimates/${estimate.id}/health`} className="btn-secondary">Health</Link><Link href={`/costing/estimates/${estimate.id}/spatial`} className="btn-secondary">Spatial Trace</Link></div>
      {nextStatuses.length>0&&<form action={changeEstimateStatusAction.bind(null, estimate.id)} className="allow-controlled-action flex flex-wrap items-center gap-2"><span className="cat">Workflow: {estimate.status}</span><select name="status" defaultValue={nextStatuses[0]} className="min-w-[150px]">{nextStatuses.map(status=><option key={status} value={status}>{status}</option>)}</select><button className="btn small">Advance status</button></form>}
    </div>}
    {controlled && <>
      <style>{`
        .controlled-estimate form:not(.allow-controlled-action) input,
        .controlled-estimate form:not(.allow-controlled-action) select,
        .controlled-estimate form:not(.allow-controlled-action) textarea,
        .controlled-estimate form:not(.allow-controlled-action) button {
          pointer-events: none !important;
          opacity: .55 !important;
          cursor: not-allowed !important;
        }
      `}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#6A4A2C] bg-[#1A120C] px-4 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#E0954F]">Controlled commercial snapshot</div>
          <div className="mt-1 text-sm text-[#DCEBF5]">EST-{String(estimate!.number).padStart(4, "0")} is {estimate!.status}. Commercial fields are read-only; use workflow actions or create a revision.</div>
        </div>
        <Link href={`/costing/estimates/${estimate!.id}/revision`} className="btn">Create revision</Link>
      </div>
    </>}
    {children}
  </div>;
}
