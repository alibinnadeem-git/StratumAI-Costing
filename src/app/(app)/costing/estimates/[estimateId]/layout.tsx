import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";

const CONTROLLED = new Set(["SUBMITTED", "AWARDED", "LOST", "ARCHIVED"]);

export default async function EstimateLayout({ children, params }: { children: React.ReactNode; params: Promise<{ estimateId: string }> }) {
  const { estimateId } = await params;
  const ctx = await requireTenantContext();
  const estimate = await db.costEstimate.findFirst({
    where: { id: estimateId, accountId: ctx.account.id },
    select: { id: true, number: true, status: true },
  });
  const controlled = !!estimate && CONTROLLED.has(estimate.status);

  return <div className={controlled ? "controlled-estimate" : undefined}>
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
          <div className="mt-1 text-sm text-[#DCEBF5]">EST-{String(estimate!.number).padStart(4, "0")} is {estimate!.status}. Commercial fields are read-only.</div>
        </div>
        <Link href={`/costing/estimates/${estimate!.id}/revision`} className="btn">Create revision</Link>
      </div>
    </>}
    {children}
  </div>;
}
