import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { createEstimateAction } from "../../actions";

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const ctx = await requireTenantContext();
  const sp = await searchParams;
  const projects = await db.project.findMany({ where: { accountId: ctx.account.id, archivedAt: null }, orderBy: { name: "asc" } });

  return <div className="max-w-3xl space-y-5">
    <section className="stratum-sheet"><h1 className="stratum-sheet-title">New Estimate</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · account defaults are snapshotted at creation</p></section>
    <section className="stratum-sheet"><form action={createEstimateAction} className="space-y-4"><label>Estimate name<input name="name" required placeholder="e.g. Fremont Data Center — Electrical Package" /></label><label>Project (optional)<select name="projectId" defaultValue={sp.projectId || ""}><option value="">Unlinked estimate</option>{projects.map(project => <option key={project.id} value={project.id}>{project.number ? `#${project.number} · ` : ""}{project.name}</option>)}</select></label><label>Notes<textarea name="notes" rows={4} placeholder="Scope assumptions, bid date, alternates, owner requirements…" /></label><button className="btn">Create estimate</button></form></section>
  </div>;
}
