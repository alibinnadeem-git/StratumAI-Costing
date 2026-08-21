import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { atLeast } from "@/lib/rbac";
import { money } from "@/lib/costing";
import { applyJobCostToItemAction, createJobCostAction } from "../actions";

export default async function JobCostsPage() {
  const ctx = await requireTenantContext();
  const [entries, items, projects] = await Promise.all([
    db.jobCostEntry.findMany({ where: { accountId: ctx.account.id }, include: { costItem: true, project: true, createdBy: { select: { name: true, email: true } } }, orderBy: { date: "desc" }, take: 250 }),
    db.costItem.findMany({ where: { accountId: ctx.account.id }, orderBy: { description: "asc" } }),
    db.project.findMany({ where: { accountId: ctx.account.id, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const canApply = atLeast(ctx.accountRole, "ADMIN");
  const canCreate = atLeast(ctx.accountRole, "MEMBER");

  return <div className="space-y-5">
    <section className="stratum-sheet"><h1 className="stratum-sheet-title">Job Cost History</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · actual labor/material calibration</p></section>
    {canCreate && <section className="stratum-sheet"><form action={createJobCostAction} className="grid gap-2 md:grid-cols-4"><input name="jobName" required placeholder="Completed work / job name" className="md:col-span-2"/><input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)}/><select name="projectId"><option value="">No project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select><select name="costItemId" className="md:col-span-2"><option value="">No catalog item</option>{items.map(item=><option key={item.id} value={item.id}>{item.description}</option>)}</select><input name="quantity" type="number" step="0.01" defaultValue="1" placeholder="Quantity"/><input name="actualLaborHours" type="number" step="0.01" defaultValue="0" placeholder="Actual labor hours"/><input name="actualMaterialCost" type="number" step="0.01" defaultValue="0" placeholder="Actual material total $"/><input name="notes" placeholder="Notes" className="md:col-span-2"/><button className="btn">Log actual</button></form></section>}
    <section className="stratum-sheet"><div className="table-scroll"><table className="min-w-[900px]"><thead><tr><th>Date / work</th><th>Catalog item</th><th className="num">Qty</th><th className="num">Labor/unit</th><th className="num">Material/unit</th><th>Project</th><th/></tr></thead><tbody>{entries.map(entry=>{const laborPerUnit=entry.quantity?entry.actualLaborHours/entry.quantity:0;const materialPerUnit=entry.quantity?entry.actualMaterialCost/entry.quantity:0;return <tr key={entry.id}><td className="desc-cell">{entry.jobName}<span className="cat">{entry.date.toISOString().slice(0,10)} · {entry.createdBy?.name||entry.createdBy?.email||"—"}</span></td><td>{entry.costItem?.description||"—"}</td><td className="num">{entry.quantity}</td><td className="num">{laborPerUnit.toFixed(3)} hr</td><td className="num">{money(materialPerUnit)}</td><td>{entry.project?.name||"—"}</td><td>{canApply&&entry.costItemId&&<form action={applyJobCostToItemAction}><input type="hidden" name="entryId" value={entry.id}/><button className="btn small">Apply to item</button></form>}</td></tr>})}</tbody></table></div>{entries.length===0&&<div className="empty-state mt-3">No job-cost actuals logged in this account yet.</div>}</section>
  </div>;
}
