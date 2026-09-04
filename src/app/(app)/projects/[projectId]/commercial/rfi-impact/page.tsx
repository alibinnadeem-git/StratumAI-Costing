import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { getRfiCommercialImpacts } from "@/lib/commercial-intelligence";
import { saveRfiCommercialImpactAction } from "../impact-actions";
import { money } from "@/lib/costing";

export default async function RfiImpactRegisterPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireTenantContext();
  const project = await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } });
  if (!project) notFound();

  const rfis = await db.rfi.findMany({ where: { projectId, project: { accountId: ctx.account.id } }, orderBy: [{ status: "asc" }, { priority: "desc" }, { number: "desc" }] });
  const impacts = await getRfiCommercialImpacts(ctx.account.id, rfis.map((r) => r.id));
  const impactByRfi = new Map(impacts.map((i) => [i.rfiId, i]));
  const confirmedCost = impacts.filter((i) => i.classification === "CONFIRMED").reduce((sum, i) => sum + i.costImpact, 0);
  const potentialCost = impacts.filter((i) => i.classification === "POTENTIAL").reduce((sum, i) => sum + i.costImpact, 0);
  const scheduleDays = impacts.reduce((max, i) => Math.max(max, i.scheduleDays), 0);
  const laborHours = impacts.reduce((sum, i) => sum + i.laborHoursImpact, 0);

  return <div className="space-y-5">
    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Commercial Intelligence · RFI Exposure</p><h1 className="stratum-sheet-title">{project.name} RFI Impact Register</h1><p className="mt-2 text-sm text-[#9CB2C2]">Quantify potential and confirmed commercial exposure without changing the underlying RFI record.</p></div><div className="flex gap-2"><Link href={`/projects/${projectId}/commercial`} className="btn-secondary">Commercial risk</Link><Link href={`/projects/${projectId}`} className="btn-secondary">Project</Link></div></div></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="stratum-sheet"><span className="cat">Confirmed cost exposure</span><div className="mt-2 text-2xl font-semibold text-rose-400">{money(confirmedCost)}</div></div><div className="stratum-sheet"><span className="cat">Potential cost exposure</span><div className="mt-2 text-2xl font-semibold text-amber-300">{money(potentialCost)}</div></div><div className="stratum-sheet"><span className="cat">Schedule exposure</span><div className="mt-2 text-2xl font-semibold text-[#DCEBF5]">{scheduleDays}d</div></div><div className="stratum-sheet"><span className="cat">Labor exposure</span><div className="mt-2 text-2xl font-semibold text-[#DCEBF5]">{laborHours.toFixed(1)} hr</div></div></section>

    <section className="space-y-3">{rfis.map((rfi) => {
      const impact = impactByRfi.get(rfi.id);
      return <form key={rfi.id} action={saveRfiCommercialImpactAction.bind(null, projectId)} className="stratum-sheet"><input type="hidden" name="rfiId" value={rfi.id}/><div className="grid gap-3 xl:grid-cols-[220px_1fr_150px_140px_140px_1fr_auto] xl:items-end"><div><span className="cat">RFI-{String(rfi.number).padStart(3,"0")} · {rfi.status}</span><div className="mt-1 text-sm font-semibold text-[#DCEBF5]">{rfi.subject}</div><div className="cat">{rfi.priority} · {rfi.location || rfi.sheet || "No location"}</div></div><label>Classification<select name="classification" defaultValue={impact?.classification || "POTENTIAL"}><option value="NONE">None</option><option value="POTENTIAL">Potential</option><option value="CONFIRMED">Confirmed</option></select></label><label>Cost impact $<input name="costImpact" type="number" min="0" step="0.01" defaultValue={impact?.costImpact ?? 0}/></label><label>Schedule days<input name="scheduleDays" type="number" min="0" step="1" defaultValue={impact?.scheduleDays ?? 0}/></label><label>Labor hours<input name="laborHoursImpact" type="number" min="0" step="0.1" defaultValue={impact?.laborHoursImpact ?? 0}/></label><label>Commercial notes<input name="notes" defaultValue={impact?.notes || ""} placeholder="Scope, assumption, owner, mitigation…"/></label><button className="btn h-[35px]">Save impact</button></div></form>;
    })}{rfis.length===0&&<div className="stratum-sheet empty-state">No RFIs exist for this project.</div>}</section>
  </div>;
}
