import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { createEstimateAction } from "../../actions";

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const ctx=await requireOrgContext();
  const sp=await searchParams;
  const projects=await db.project.findMany({where:{organizationId:ctx.organization.id,archivedAt:null},orderBy:{name:"asc"}});
  return <div className="space-y-5 max-w-3xl"><PageHeader eyebrow={ctx.organization.name} title="New Estimate" subtitle="The current organization defaults are copied into the estimate and can then be overridden without changing shop-wide settings." />
    <Card className="p-5"><form action={createEstimateAction} className="space-y-4"><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Estimate name</span><input name="name" required placeholder="e.g. Fremont Data Center — Electrical Package" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"/></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Project (optional)</span><select name="projectId" defaultValue={sp.projectId||""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Unlinked estimate</option>{projects.map(p=><option key={p.id} value={p.id}>{p.number?`#${p.number} · `:""}{p.name}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Notes</span><textarea name="notes" rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Scope assumptions, bid date, alternates, owner requirements…"/></label><button className="rounded-lg bg-signal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-signal-700">Create estimate</button></form></Card>
  </div>;
}
