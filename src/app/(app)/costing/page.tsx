import Link from "next/link";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";
import { NECA_META } from "@/lib/costing-data";

export default async function CostingOverviewPage() {
  const ctx = await requireTenantContext();
  const [items, estimates, jobCosts, quotes, settings, marketCount] = await Promise.all([
    db.costItem.count({ where: { accountId: ctx.account.id } }),
    db.costEstimate.findMany({
      where: { accountId: ctx.account.id, status: { not: "ARCHIVED" } },
      include: { lineItems: true, adders: true, project: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    db.jobCostEntry.count({ where: { accountId: ctx.account.id } }),
    db.supplierQuote.count({ where: { accountId: ctx.account.id } }),
    db.costSettings.findUnique({ where: { accountId: ctx.account.id } }),
    db.marketFactor.count({ where: { accountId: ctx.account.id } }),
  ]);

  const priced = estimates.map((estimate) => ({
    estimate,
    total: calculateEstimate({
      lines: estimate.lineItems,
      adders: estimate.adders,
      laborRate: estimate.laborRate,
      overheadPercent: estimate.overheadPercent,
      profitMarginPercent: estimate.profitMarginPercent,
      difficultyMultiplier: estimate.difficultyMultiplier,
      condition: estimate.condition,
    }).total,
  }));
  const pipeline = priced.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="space-y-5">
      <section className="stratum-sheet">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="stratum-sheet-title">Analytics</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">
              {ctx.organization.name} · {ctx.account.name} · commercial intelligence workspace
            </p>
          </div>
          <Link href="/costing/estimates/new" className="btn">New estimate</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ["Cost Items", String(items)],
          ["Active Estimates", String(estimates.length)],
          ["Pipeline", money(pipeline)],
          ["Job Actuals", String(jobCosts)],
          ["Supplier Quotes", String(quotes)],
          ["Verified NECA", String(NECA_META.rowCount)],
        ].map(([label, value]) => (
          <div key={label} className="stratum-sheet !mb-0 !p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.07em] text-[#6D8AA0]">{label}</div>
            <div className="mt-2 font-mono text-lg text-[#6FD6C9]">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="stratum-sheet">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="stratum-sheet-title">Recent Estimates</h2>
            <Link href="/costing/estimates" className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#E0954F]">View all →</Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Estimate</th><th>Project</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>
                {priced.slice(0, 8).map(({ estimate, total }) => (
                  <tr key={estimate.id}>
                    <td><Link href={`/costing/estimates/${estimate.id}`} className="text-[#DCEBF5] hover:text-[#E0954F]">EST-{String(estimate.number).padStart(4, "0")} · {estimate.name}</Link></td>
                    <td>{estimate.project?.name ?? "—"}</td>
                    <td><span className="tag REF">{estimate.status}</span></td>
                    <td className="num text-[#6FD6C9]">{money(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {priced.length === 0 && <div className="empty-state mt-3">No estimates in this account yet.</div>}
        </div>

        <div className="stratum-sheet">
          <h2 className="stratum-sheet-title">Account Defaults</h2>
          <div className="mt-4 space-y-2 font-mono text-[11px]">
            <Line label="Labor rate" value={`${money(settings?.laborRate ?? 95)}/hr`} />
            <Line label="Overhead" value={`${settings?.overheadPercent ?? 12}%`} />
            <Line label="Profit margin" value={`${settings?.profitMarginPercent ?? 15}%`} />
            <Line label="Condition" value={(settings?.defaultCondition ?? "NORMAL").replaceAll("_", " ")} />
            <Line label="Market signals" value={String(marketCount)} />
          </div>
          <Link href="/costing/settings" className="btn small mt-4 inline-block">Edit settings</Link>
        </div>
      </section>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="summary-line"><span>{label}</span><b>{value}</b></div>;
}
