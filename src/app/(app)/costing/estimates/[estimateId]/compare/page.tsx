import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { calculateEstimate, money } from "@/lib/costing";

type RevisionRow = { parentEstimateId: string };
type Line = { id: string; costItemId: string | null; description: string; quantity: number; unit: string; materialCost: number; laborHoursPerUnit: number };

function keyFor(line: Line) {
  return line.costItemId ? `item:${line.costItemId}` : `custom:${line.description.toLowerCase()}|${line.unit.toLowerCase()}`;
}

export default async function EstimateComparePage({ params }: { params: Promise<{ estimateId: string }> }) {
  const { estimateId } = await params;
  const ctx = await requireTenantContext();
  const current = await db.costEstimate.findFirst({
    where: { id: estimateId, accountId: ctx.account.id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } }, adders: true, project: true },
  });
  if (!current) notFound();

  const lineage = await db.$queryRaw<RevisionRow[]>`
    SELECT "parentEstimateId"
    FROM "EstimateRevisionLink"
    WHERE "childEstimateId" = ${current.id}
      AND "accountId" = ${ctx.account.id}
    LIMIT 1
  `;
  const parentId = lineage[0]?.parentEstimateId;
  const parent = parentId ? await db.costEstimate.findFirst({
    where: { id: parentId, accountId: ctx.account.id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } }, adders: true, project: true },
  }) : null;

  if (!parent) {
    return <div className="space-y-5"><section className="stratum-sheet"><h1 className="stratum-sheet-title">No revision source found</h1><p className="mt-2 text-sm text-[#9CB2C2]">This estimate was not created through the controlled revision workflow, so there is no parent snapshot to compare.</p><Link href={`/costing/estimates/${current.id}`} className="btn mt-4 inline-flex">Back to estimate</Link></section></div>;
  }

  const currentTotals = calculateEstimate({ lines: current.lineItems, adders: current.adders, laborRate: current.laborRate, overheadPercent: current.overheadPercent, profitMarginPercent: current.profitMarginPercent, difficultyMultiplier: current.difficultyMultiplier, condition: current.condition });
  const parentTotals = calculateEstimate({ lines: parent.lineItems, adders: parent.adders, laborRate: parent.laborRate, overheadPercent: parent.overheadPercent, profitMarginPercent: parent.profitMarginPercent, difficultyMultiplier: parent.difficultyMultiplier, condition: parent.condition });

  const oldMap = new Map(parent.lineItems.map((line) => [keyFor(line), line]));
  const newMap = new Map(current.lineItems.map((line) => [keyFor(line), line]));
  const allKeys = Array.from(new Set([...oldMap.keys(), ...newMap.keys()]));
  const changes = allKeys.map((key) => {
    const before = oldMap.get(key);
    const after = newMap.get(key);
    const status = !before ? "ADDED" : !after ? "REMOVED" : before.quantity !== after.quantity || before.materialCost !== after.materialCost || before.laborHoursPerUnit !== after.laborHoursPerUnit ? "CHANGED" : "UNCHANGED";
    return { key, before, after, status };
  }).filter((row) => row.status !== "UNCHANGED");

  const totalDelta = currentTotals.total - parentTotals.total;

  return <div className="space-y-5">
    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Estimate Lineage · Commercial Delta</p><h1 className="stratum-sheet-title">EST-{String(parent.number).padStart(4, "0")} → EST-{String(current.number).padStart(4, "0")}</h1><p className="mt-2 text-sm text-[#9CB2C2]">Source snapshot versus current revision. The source remains unchanged.</p></div><div className="flex gap-2"><Link href={`/costing/estimates/${parent.id}`} className="btn-secondary">Source</Link><Link href={`/costing/estimates/${current.id}`} className="btn">Current revision</Link></div></div></section>

    <section className="grid gap-3 md:grid-cols-3">
      <div className="stratum-sheet"><span className="cat">Source price</span><div className="mt-2 font-mono text-xl text-[#DCEBF5]">{money(parentTotals.total)}</div></div>
      <div className="stratum-sheet"><span className="cat">Revision price</span><div className="mt-2 font-mono text-xl text-[#DCEBF5]">{money(currentTotals.total)}</div></div>
      <div className="stratum-sheet"><span className="cat">Commercial delta</span><div className={`mt-2 font-mono text-xl ${totalDelta > 0 ? "text-[#E0954F]" : totalDelta < 0 ? "text-[#6FD6C9]" : "text-[#DCEBF5]"}`}>{totalDelta > 0 ? "+" : ""}{money(totalDelta)}</div></div>
    </section>

    <section className="stratum-sheet"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#DCEBF5]">Line changes</h2><p className="mt-1 text-xs text-[#8FA8B8]">Added, removed, quantity, material-rate, and labor-basis changes.</p></div><span className="tag REF">{changes.length} change{changes.length === 1 ? "" : "s"}</span></div>
      <div className="table-scroll mt-3"><table className="min-w-[920px]"><thead><tr><th>Status</th><th>Description</th><th className="num">Qty before</th><th className="num">Qty after</th><th className="num">Material before</th><th className="num">Material after</th><th className="num">Labor before</th><th className="num">Labor after</th></tr></thead><tbody>{changes.map((row) => {
        const line = row.after || row.before!;
        return <tr key={row.key}><td><span className="tag REF">{row.status}</span></td><td>{line.description}</td><td className="num">{row.before?.quantity ?? "—"}</td><td className="num">{row.after?.quantity ?? "—"}</td><td className="num">{row.before ? money(row.before.materialCost) : "—"}</td><td className="num">{row.after ? money(row.after.materialCost) : "—"}</td><td className="num">{row.before?.laborHoursPerUnit ?? "—"}</td><td className="num">{row.after?.laborHoursPerUnit ?? "—"}</td></tr>;
      })}</tbody></table></div>{changes.length === 0 && <div className="empty-state mt-3">No line-level changes yet. This revision still matches its source snapshot.</div>}</section>
  </div>;
}
