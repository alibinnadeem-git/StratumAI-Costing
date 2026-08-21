import Link from "next/link";
import { BookOpenCheck, Boxes, FileSpreadsheet, History, Tags, TrendingUp } from "lucide-react";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";
import { NECA_META } from "@/lib/costing-data";
import { Card, PageHeader, SectionLabel, StatCard } from "@/components/ui";

export default async function CostingOverviewPage() {
  const ctx = await requireOrgContext();
  const [items, estimates, jobCosts, quotes, settings, marketCount] = await Promise.all([
    db.costItem.count({ where: { organizationId: ctx.organization.id } }),
    db.costEstimate.findMany({
      where: { organizationId: ctx.organization.id, status: { not: "ARCHIVED" } },
      include: { lineItems: true, adders: true, project: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    db.jobCostEntry.count({ where: { organizationId: ctx.organization.id } }),
    db.supplierQuote.count({ where: { organizationId: ctx.organization.id } }),
    db.costSettings.findUnique({ where: { organizationId: ctx.organization.id } }),
    db.marketFactor.count({ where: { organizationId: ctx.organization.id } }),
  ]);

  const priced = estimates.map((e) => ({
    estimate: e,
    total: calculateEstimate({
      lines: e.lineItems,
      adders: e.adders,
      laborRate: e.laborRate,
      overheadPercent: e.overheadPercent,
      profitMarginPercent: e.profitMarginPercent,
      difficultyMultiplier: e.difficultyMultiplier,
      condition: e.condition,
    }).total,
  }));
  const pipeline = priced.reduce((a, e) => a + e.total, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${ctx.organization.name} · Estimating`}
        title="Stratum AI Costing"
        subtitle="Tenant-scoped item rates, NECA labor, estimates, supplier pricing, job-cost calibration and market intelligence."
        actions={<Link href="/costing/estimates/new" className="rounded-lg bg-signal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-signal-700">New estimate</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Cost items" value={items} icon={<Boxes className="h-5 w-5" />} />
        <StatCard label="Active estimates" value={estimates.length} tone="text-signal-600" icon={<FileSpreadsheet className="h-5 w-5" />} />
        <StatCard label="Estimate pipeline" value={money(pipeline)} tone="text-emerald-600" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Job actuals" value={jobCosts} icon={<History className="h-5 w-5" />} />
        <StatCard label="Supplier quotes" value={quotes} icon={<Tags className="h-5 w-5" />} />
        <StatCard label="Verified NECA" value={NECA_META.rowCount} tone="text-amber-600" icon={<BookOpenCheck className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <div>
          <div className="mb-2 flex items-center justify-between"><SectionLabel>Recent estimates</SectionLabel><Link href="/costing/estimates" className="text-xs font-semibold text-signal-600">View all →</Link></div>
          <Card className="overflow-hidden">
            {priced.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No estimates yet.</div> : (
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-2.5">Estimate</th><th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Total</th></tr></thead>
                <tbody>{priced.slice(0,8).map(({estimate:e,total}) => <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="px-4 py-2.5"><Link href={`/costing/estimates/${e.id}`} className="font-semibold text-slate-800 hover:text-signal-600">EST-{String(e.number).padStart(4,"0")} · {e.name}</Link></td><td className="px-4 py-2.5 text-slate-500">{e.project?.name ?? "—"}</td><td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{e.status}</td><td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800">{money(total)}</td></tr>)}</tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <SectionLabel>Organization estimating defaults</SectionLabel>
          <Card className="p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Labor rate</dt><dd className="font-mono font-semibold">{money(settings?.laborRate ?? 95)}/hr</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Overhead</dt><dd className="font-mono font-semibold">{settings?.overheadPercent ?? 12}%</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Profit margin</dt><dd className="font-mono font-semibold">{settings?.profitMarginPercent ?? 15}%</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Default condition</dt><dd className="font-mono font-semibold">{(settings?.defaultCondition ?? "NORMAL").replaceAll("_"," ")}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Market signals</dt><dd className="font-mono font-semibold">{marketCount}</dd></div>
            </dl>
            <Link href="/costing/settings" className="mt-4 inline-block text-xs font-semibold text-signal-600">Edit settings →</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
