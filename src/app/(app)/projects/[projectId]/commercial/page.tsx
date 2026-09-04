import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { calculateEstimate, money } from "@/lib/costing";

type ImpactRow={rfiId:string;classification:string;costImpact:number;scheduleDays:number;laborHoursImpact:number;notes:string|null};
type SpatialRfiRow={annotationId:string;rfiId:string;contextType:string;drawingRevisionId:string|null;realityCaptureSpaceId:string|null;annotationTitle:string;annotationType:string;priority:string;sheetNumber:string|null;revision:string|null;captureName:string|null};
type LeadTimeRow={supplierId:string;supplierName:string;category:string;leadTimeDays:number;asOf:Date;validUntil:Date|null;source:string|null};

function keyForQuote(q: { costItemId: string | null; description: string; unit: string }) {
  return q.costItemId ? `item:${q.costItemId}` : `desc:${q.description.trim().toLowerCase()}|${q.unit.trim().toLowerCase()}`;
}

function daysFromNow(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export default async function ProjectCommercialPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireTenantContext();
  const project = await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } });
  if (!project) notFound();

  const [rfis, rfqs, quotes, estimates, impacts, spatialRfis, leadTimes] = await Promise.all([
    db.rfi.findMany({ where: { projectId, project: { accountId: ctx.account.id } }, orderBy: { number: "desc" } }),
    db.rfq.findMany({ where: { projectId, project: { accountId: ctx.account.id } }, include: { lineItems: true, recipients: { include: { supplier: true } } }, orderBy: { number: "desc" } }),
    db.supplierQuote.findMany({ where: { projectId, accountId: ctx.account.id }, include: { supplier: true, costItem: true }, orderBy: { quoteDate: "desc" } }),
    db.costEstimate.findMany({ where: { projectId, accountId: ctx.account.id }, include: { lineItems: true, adders: true }, orderBy: { updatedAt: "desc" } }),
    db.$queryRawUnsafe<ImpactRow[]>(`SELECT i."rfiId",i."classification",i."costImpact",i."scheduleDays",i."laborHoursImpact",i."notes" FROM "RfiCommercialImpact" i JOIN "Rfi" r ON r."id"=i."rfiId" JOIN "Project" p ON p."id"=r."projectId" WHERE r."projectId"=$1 AND i."accountId"=$2 AND p."accountId"=$2`,projectId,ctx.account.id),
    db.$queryRawUnsafe<SpatialRfiRow[]>(`SELECT a."id" AS "annotationId",a."linkedEntityId" AS "rfiId",a."contextType",a."drawingRevisionId",a."realityCaptureSpaceId",a."title" AS "annotationTitle",a."annotationType",a."priority",dr."sheetNumber",dr."revision",rc."name" AS "captureName" FROM "SpatialAnnotation" a LEFT JOIN "DrawingRevision" dr ON dr."id"=a."drawingRevisionId" LEFT JOIN "RealityCaptureSpace" rc ON rc."id"=a."realityCaptureSpaceId" WHERE a."projectId"=$1 AND a."accountId"=$2 AND a."linkedEntityType"='RFI' AND a."linkedEntityId" IS NOT NULL`,projectId,ctx.account.id),
    db.$queryRawUnsafe<LeadTimeRow[]>(`SELECT l."supplierId",s."name" AS "supplierName",l."category",l."leadTimeDays",l."asOf",l."validUntil",l."source" FROM "SupplierLeadTime" l JOIN "Supplier" s ON s."id"=l."supplierId" WHERE l."accountId"=$1 AND s."accountId"=$1 ORDER BY l."leadTimeDays" DESC`,ctx.account.id),
  ]);

  const now = new Date();
  const openRfis = rfis.filter((r) => r.status === "OPEN");
  const highOpenRfis = openRfis.filter((r) => r.priority === "HIGH");
  const overdueRfqs = rfqs.filter((r) => r.status !== "CLOSED" && r.dueDate && r.dueDate < now);
  const activeQuotes = quotes.filter((q) => !q.validUntil || q.validUntil >= now);
  const expiredQuotes = quotes.filter((q) => q.validUntil && q.validUntil < now);
  const expiringSoon = quotes.filter((q) => q.validUntil && q.validUntil >= now && daysFromNow(q.validUntil) <= 14);
  const sentRecipients = rfqs.flatMap((r) => r.recipients).filter((r) => r.status === "SENT" || r.status === "RESPONDED");
  const respondedRecipients = rfqs.flatMap((r) => r.recipients).filter((r) => r.status === "RESPONDED");
  const responseRate = sentRecipients.length ? Math.round((respondedRecipients.length / sentRecipients.length) * 100) : 0;
  const impactByRfi=new Map(impacts.map(i=>[i.rfiId,i]));
  const spatialByRfi=new Map(spatialRfis.map(s=>[s.rfiId,s]));
  const confirmedImpacts=impacts.filter(i=>i.classification==="CONFIRMED");
  const potentialImpacts=impacts.filter(i=>i.classification==="POTENTIAL");
  const confirmedCost=confirmedImpacts.reduce((n,i)=>n+i.costImpact,0);
  const potentialCost=potentialImpacts.reduce((n,i)=>n+i.costImpact,0);
  const scheduleExposure=Math.max(0,...impacts.filter(i=>i.classification!=="NONE").map(i=>i.scheduleDays));
  const longLeadTimes=leadTimes.filter(l=>(!l.validUntil||l.validUntil>=now)&&l.leadTimeDays>=42);

  const quoteGroups = new Map<string, typeof quotes>();
  for (const quote of quotes) {
    const key = keyForQuote(quote);
    const group = quoteGroups.get(key) || [];
    group.push(quote);
    quoteGroups.set(key, group);
  }
  const leveled = Array.from(quoteGroups.values()).map((group) => {
    const sorted = [...group].sort((a, b) => a.unitMaterialCost - b.unitMaterialCost);
    const low = sorted[0]?.unitMaterialCost ?? 0;
    const high = sorted.at(-1)?.unitMaterialCost ?? 0;
    return { group: sorted, low, high, spreadPct: low > 0 ? ((high - low) / low) * 100 : 0 };
  }).sort((a, b) => b.spreadPct - a.spreadPct);

  const estimateSummaries = estimates.map((estimate) => ({
    estimate,
    total: calculateEstimate({ lines: estimate.lineItems, adders: estimate.adders, laborRate: estimate.laborRate, overheadPercent: estimate.overheadPercent, profitMarginPercent: estimate.profitMarginPercent, difficultyMultiplier: estimate.difficultyMultiplier, condition: estimate.condition }).total,
    unpriced: estimate.lineItems.filter((l) => l.materialCost <= 0 && l.laborHoursPerUnit <= 0).length,
  }));

  const riskPoints = highOpenRfis.length * 10 + openRfis.length * 3 + overdueRfqs.length * 10 + expiredQuotes.length * 5 + confirmedImpacts.length * 12 + potentialImpacts.length * 6 + longLeadTimes.length * 4 + estimateSummaries.reduce((n, e) => n + Math.min(e.unpriced * 2, 20), 0);
  const riskLabel = riskPoints >= 50 ? "HIGH" : riskPoints >= 20 ? "MEDIUM" : "LOW";

  return <div className="space-y-5">
    <section className="stratum-sheet">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Commercial Intelligence · {ctx.account.name}</p><h1 className="stratum-sheet-title">{project.name} Commercial Risk</h1><p className="mt-2 text-sm text-[#9CB2C2]">Procurement coverage, quote validity, supplier lead time, spatial/RFI exposure, and estimate readiness from tenant-scoped project data.</p></div><div className="flex flex-wrap gap-2"><Link href={`/projects/${project.id}/annotations`} className="btn-secondary">Spatial annotations</Link><Link href={`/projects/${project.id}/drawings/viewer`} className="btn-secondary">Spatial Viewer</Link><Link href={`/projects/${project.id}`} className="btn-secondary">Back to project</Link></div></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
      <div className="stratum-sheet"><span className="cat">Risk</span><div className={`mt-2 text-2xl font-semibold ${riskLabel === "HIGH" ? "text-rose-400" : riskLabel === "MEDIUM" ? "text-amber-300" : "text-[#6FD6C9]"}`}>{riskLabel}</div><div className="cat">{riskPoints} exposure points</div></div>
      <div className="stratum-sheet"><span className="cat">Open RFIs</span><div className="mt-2 text-2xl font-semibold text-[#DCEBF5]">{openRfis.length}</div><div className="cat">{highOpenRfis.length} high priority</div></div>
      <div className="stratum-sheet"><span className="cat">Confirmed impact</span><div className="mt-2 text-2xl font-semibold text-rose-400">{money(confirmedCost)}</div><div className="cat">{confirmedImpacts.length} RFI impact{confirmedImpacts.length===1?"":"s"}</div></div>
      <div className="stratum-sheet"><span className="cat">Potential impact</span><div className="mt-2 text-2xl font-semibold text-amber-300">{money(potentialCost)}</div><div className="cat">{potentialImpacts.length} awaiting decision</div></div>
      <div className="stratum-sheet"><span className="cat">Schedule exposure</span><div className="mt-2 text-2xl font-semibold text-[#DCEBF5]">{scheduleExposure}d</div><div className="cat">max recorded RFI impact</div></div>
      <div className="stratum-sheet"><span className="cat">Long lead</span><div className="mt-2 text-2xl font-semibold text-amber-300">{longLeadTimes.length}</div><div className="cat">≥42 day supplier records</div></div>
      <div className="stratum-sheet"><span className="cat">Response rate</span><div className="mt-2 text-2xl font-semibold text-[#6FD6C9]">{responseRate}%</div><div className="cat">{respondedRecipients.length}/{sentRecipients.length || 0} responses</div></div>
      <div className="stratum-sheet"><span className="cat">Expired quotes</span><div className="mt-2 text-2xl font-semibold text-rose-400">{expiredQuotes.length}</div><div className="cat">refresh before award</div></div>
    </section>

    <section className="stratum-sheet">
      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[#DCEBF5]">Supplier bid leveling</h2><p className="cat">Normalized by catalog item when available; otherwise description + unit</p></div><Link href="/costing/quotes" className="btn-secondary">Manage quotes</Link></div>
      {leveled.length === 0 ? <div className="empty-state">No project supplier quotes available for comparison.</div> : <div className="table-scroll"><table className="min-w-[950px]"><thead><tr><th>Scope</th><th>Lowest supplier</th><th className="num">Low</th><th className="num">High</th><th className="num">Spread</th><th>Quote validity</th></tr></thead><tbody>{leveled.map(({ group, low, high, spreadPct }, i) => {
        const best = group[0]!; const validity = best.validUntil ? (best.validUntil < now ? "Expired" : `${daysFromNow(best.validUntil)}d remaining`) : "No expiry";
        return <tr key={`${keyForQuote(best)}-${i}`}><td className="desc-cell">{best.costItem?.description || best.description}<span className="cat">{group.length} quote{group.length === 1 ? "" : "s"} · {best.unit}</span></td><td>{best.supplier?.name || "Unassigned"}</td><td className="num text-[#6FD6C9]">{money(low)}</td><td className="num">{money(high)}</td><td className={`num ${spreadPct >= 20 ? "text-amber-300" : ""}`}>{spreadPct.toFixed(1)}%</td><td>{validity}</td></tr>;
      })}</tbody></table></div>}
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <div className="stratum-sheet"><h2 className="text-sm font-semibold text-[#DCEBF5]">Procurement exceptions</h2><div className="mt-3 space-y-2">{overdueRfqs.map((r) => <div key={r.id} className="border border-rose-900/50 bg-rose-950/20 p-3 text-sm"><div className="font-semibold text-rose-300">RFQ-{String(r.number).padStart(3,"0")} overdue</div><div className="cat">{r.title} · due {r.dueDate?.toISOString().slice(0,10)} · {r.recipients.filter((x)=>x.status==="RESPONDED").length}/{r.recipients.length} responses</div></div>)}{expiringSoon.map((q) => <div key={q.id} className="border border-amber-800/50 bg-amber-950/10 p-3 text-sm"><div className="font-semibold text-amber-200">Quote expiring soon</div><div className="cat">{q.supplier?.name || "Supplier"} · {q.description} · {q.validUntil?.toISOString().slice(0,10)}</div></div>)}{longLeadTimes.slice(0,8).map(l=><div key={`${l.supplierId}-${l.category}`} className="border border-amber-800/50 bg-amber-950/10 p-3 text-sm"><div className="font-semibold text-amber-200">Long lead · {l.leadTimeDays} days</div><div className="cat">{l.supplierName} · {l.category}{l.source?` · ${l.source}`:""}</div></div>)}{overdueRfqs.length === 0 && expiringSoon.length === 0 && longLeadTimes.length===0 && <div className="empty-state">No immediate procurement exceptions.</div>}</div></div>

      <div className="stratum-sheet"><h2 className="text-sm font-semibold text-[#DCEBF5]">Estimate exposure</h2><div className="mt-3 space-y-2">{estimateSummaries.map(({ estimate, total, unpriced }) => <Link key={estimate.id} href={`/costing/estimates/${estimate.id}`} className="block border border-[#1C3A57] bg-[#0B1F32] p-3 hover:border-[#315979]"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-[#DCEBF5]">EST-{String(estimate.number).padStart(4,"0")} · {estimate.name}</div><div className="cat">{estimate.status} · {unpriced} unpriced line{unpriced === 1 ? "" : "s"}</div></div><div className="font-mono text-sm text-[#6FD6C9]">{money(total)}</div></div></Link>)}{estimateSummaries.length === 0 && <div className="empty-state">No estimates linked to this project.</div>}</div></div>
    </section>

    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#DCEBF5]">Open RFI commercial + spatial exposure</h2><p className="cat">RFI decisions are cross-referenced to recorded cost/schedule impact and drawing/Matterport origin without changing controlled estimates.</p></div><Link href={`/projects/${projectId}/annotations`} className="btn-secondary">Review annotations</Link></div>{openRfis.length === 0 ? <div className="empty-state mt-3">No open RFIs.</div> : <div className="table-scroll mt-3"><table className="min-w-[1180px]"><thead><tr><th>RFI</th><th>Priority</th><th>Subject</th><th>Spatial source</th><th>Impact</th><th className="num">Cost</th><th className="num">Schedule</th><th className="num">Labor</th><th>Date needed</th></tr></thead><tbody>{openRfis.map((r) => {const impact=impactByRfi.get(r.id);const spatial=spatialByRfi.get(r.id);const spatialHref=spatial?.drawingRevisionId?`/projects/${projectId}/drawings/viewer?revisionId=${spatial.drawingRevisionId}`:spatial?.realityCaptureSpaceId?`/projects/${projectId}/reality-capture?spaceId=${spatial.realityCaptureSpaceId}`:null;return <tr key={r.id}><td className="font-mono">RFI-{String(r.number).padStart(3,"0")}</td><td className={r.priority === "HIGH" ? "text-rose-400" : ""}>{r.priority}</td><td>{r.subject}</td><td>{spatial?(spatialHref?<Link href={spatialHref} className="text-[#6FD6C9] hover:underline">{spatial.contextType==="DRAWING"?`${spatial.sheetNumber||"Drawing"}${spatial.revision?` R${spatial.revision}`:""}`:spatial.captureName||"Matterport"}</Link>:spatial.annotationTitle):"—"}</td><td className={impact?.classification==="CONFIRMED"?"text-rose-400":impact?.classification==="POTENTIAL"?"text-amber-300":""}>{impact?.classification||"UNASSESSED"}</td><td className="num">{impact?money(impact.costImpact):"—"}</td><td className="num">{impact?`${impact.scheduleDays}d`:"—"}</td><td className="num">{impact?`${impact.laborHoursImpact.toFixed(1)}h`:"—"}</td><td>{r.dateNeeded?.toISOString().slice(0,10) || "—"}</td></tr>})}</tbody></table></div>}</section>
  </div>;
}
