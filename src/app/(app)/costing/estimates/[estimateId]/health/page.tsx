import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { calculateEstimate, money } from "@/lib/costing";

type Check = { label: string; detail: string; deduction: number; severity: "ok" | "warn" | "risk" };

export default async function EstimateHealthPage({ params }: { params: Promise<{ estimateId: string }> }) {
  const { estimateId } = await params;
  const ctx = await requireTenantContext();
  const estimate = await db.costEstimate.findFirst({
    where: { id: estimateId, accountId: ctx.account.id },
    include: { lineItems: true, adders: true, project: true },
  });
  if (!estimate) notFound();

  const [openRfis, projectQuotes, expiredQuotes] = estimate.projectId
    ? await Promise.all([
        db.rfi.count({ where: { projectId: estimate.projectId, status: "OPEN" } }),
        db.supplierQuote.count({ where: { accountId: ctx.account.id, projectId: estimate.projectId } }),
        db.supplierQuote.count({ where: { accountId: ctx.account.id, projectId: estimate.projectId, validUntil: { lt: new Date() } } }),
      ])
    : [0, 0, 0];

  const totals = calculateEstimate({
    lines: estimate.lineItems,
    adders: estimate.adders,
    laborRate: estimate.laborRate,
    overheadPercent: estimate.overheadPercent,
    profitMarginPercent: estimate.profitMarginPercent,
    difficultyMultiplier: estimate.difficultyMultiplier,
    condition: estimate.condition,
  });

  const unpriced = estimate.lineItems.filter((line) => line.materialCost <= 0 && line.laborHoursPerUnit <= 0).length;
  const zeroQty = estimate.lineItems.filter((line) => line.quantity <= 0).length;
  const materialBearingLines = estimate.lineItems.filter((line) => line.materialCost > 0).length;

  const checks: Check[] = [];
  checks.push(estimate.lineItems.length > 0
    ? { label: "Estimate scope", detail: `${estimate.lineItems.length} priced/scoped line items loaded.`, deduction: 0, severity: "ok" }
    : { label: "Estimate scope", detail: "No estimate lines exist yet.", deduction: 30, severity: "risk" });
  checks.push(unpriced === 0
    ? { label: "Unpriced scope", detail: "Every current line has material and/or labor basis.", deduction: 0, severity: "ok" }
    : { label: "Unpriced scope", detail: `${unpriced} line${unpriced === 1 ? "" : "s"} have neither material cost nor labor hours.`, deduction: Math.min(30, unpriced * 5), severity: "risk" });
  checks.push(zeroQty === 0
    ? { label: "Quantity validation", detail: "No zero-quantity lines detected.", deduction: 0, severity: "ok" }
    : { label: "Quantity validation", detail: `${zeroQty} line${zeroQty === 1 ? "" : "s"} have zero quantity and should be reviewed.`, deduction: Math.min(15, zeroQty * 3), severity: "warn" });
  checks.push(estimate.projectId
    ? { label: "Project context", detail: `Linked to ${estimate.project?.name || "project"}.`, deduction: 0, severity: "ok" }
    : { label: "Project context", detail: "Estimate is not linked to a project, limiting RFI/procurement readiness checks.", deduction: 5, severity: "warn" });

  if (estimate.projectId) {
    checks.push(openRfis === 0
      ? { label: "Open RFIs", detail: "No open RFIs on the linked project.", deduction: 0, severity: "ok" }
      : { label: "Open RFIs", detail: `${openRfis} open RFI${openRfis === 1 ? "" : "s"} may affect scope or pricing.`, deduction: Math.min(20, openRfis * 5), severity: "warn" });
    checks.push(expiredQuotes === 0
      ? { label: "Quote validity", detail: "No expired project supplier quotes detected.", deduction: 0, severity: "ok" }
      : { label: "Quote validity", detail: `${expiredQuotes} supplier quote${expiredQuotes === 1 ? "" : "s"} have expired validity dates.`, deduction: Math.min(15, expiredQuotes * 5), severity: "risk" });
    checks.push(materialBearingLines === 0 || projectQuotes > 0
      ? { label: "Supplier quote coverage", detail: materialBearingLines === 0 ? "No material-priced lines currently require supplier quote coverage." : `${projectQuotes} project supplier quote${projectQuotes === 1 ? "" : "s"} available.`, deduction: 0, severity: "ok" }
      : { label: "Supplier quote coverage", detail: "Material-priced scope exists but no project supplier quotes are recorded.", deduction: 10, severity: "warn" });
  }

  const score = Math.max(0, 100 - checks.reduce((sum, check) => sum + check.deduction, 0));
  const readiness = score >= 90 ? "Ready" : score >= 75 ? "Review" : score >= 60 ? "At Risk" : "Not Ready";

  return <div className="space-y-5">
    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Bid Health · Explainable Readiness</p><h1 className="stratum-sheet-title">EST-{String(estimate.number).padStart(4, "0")} · {estimate.name}</h1><p className="mt-2 text-sm text-[#9CB2C2]">Every deduction below is visible and derived from data currently stored in STRATUM Electric.</p></div><Link href={`/costing/estimates/${estimate.id}`} className="btn-secondary">Back to estimate</Link></div></section>

    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="stratum-sheet"><span className="cat">Health score</span><div className="mt-2 font-mono text-5xl text-[#6FD6C9]">{score}</div><div className="mt-2 text-lg font-semibold text-[#DCEBF5]">{readiness}</div><div className="mt-4 border-t border-[#243746] pt-4 text-sm text-[#8FA8B8]">Current estimate value <span className="block mt-1 font-mono text-[#DCEBF5]">{money(totals.total)}</span></div></div>
      <div className="stratum-sheet space-y-2">{checks.map((check) => <div key={check.label} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#243746] bg-[#0C1720] p-3"><div><div className="font-semibold text-[#DCEBF5]">{check.label}</div><div className="mt-1 text-xs text-[#8FA8B8]">{check.detail}</div></div><div className={check.deduction === 0 ? "font-mono text-xs text-[#6FD6C9]" : "font-mono text-xs text-[#E0954F]"}>{check.deduction === 0 ? "PASS" : `-${check.deduction}`}</div></div>)}</div>
    </section>

    <section className="stratum-sheet"><h2 className="text-sm font-semibold text-[#DCEBF5]">Coverage roadmap</h2><p className="mt-2 text-xs leading-6 text-[#8FA8B8]">The current score uses data the platform can prove today. Drawing-revision review, exclusions/assumptions completeness, supplier coverage by individual estimate line, spatial provenance, and takeoff approval will be added to the score as those PRD capabilities become available; they are intentionally not fabricated into the score now.</p></section>
  </div>;
}
