import Link from "next/link";
import { Calculator, ClipboardList, FolderOpen, Plus, Radar, ReceiptText, ScanSearch, ShoppingCart, Sparkles } from "lucide-react";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";
import { Card, PageHeader, SectionLabel, StatCard } from "@/components/ui";

const ACTIONS = [
  { href: "/costing/estimates/new", title: "Create an estimate", text: "Start pricing a new job or scope.", icon: ReceiptText, step: "01" },
  { href: "/projects", title: "Open a project", text: "Work with takeoffs, RFIs and RFQs.", icon: FolderOpen, step: "02" },
  { href: "/costing/items", title: "Update costs", text: "Review labor and material pricing.", icon: Calculator, step: "03" },
  { href: "/costing/job-costs", title: "Record actuals", text: "Capture completed-job cost and labor.", icon: ClipboardList, step: "04" },
];

export default async function DashboardPage() {
  const ctx = await requireTenantContext();
  const accountId = ctx.account.id;

  const [projects, estimates, supplierCount, rfqCount, openRfiCount] = await Promise.all([
    db.project.findMany({ where: { accountId, archivedAt: null }, include: { _count: { select: { rfis: true, rfqs: true, estimates: true } } }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.costEstimate.findMany({ where: { accountId, status: { not: "ARCHIVED" } }, include: { lineItems: true, adders: true, project: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.supplier.count({ where: { accountId } }),
    db.rfq.count({ where: { project: { accountId } } }),
    db.rfi.count({ where: { project: { accountId }, status: "OPEN" } }),
  ]);

  const estimatePipeline = estimates.reduce((sum, e) => sum + calculateEstimate({
    lines: e.lineItems,
    adders: e.adders,
    laborRate: e.laborRate,
    overheadPercent: e.overheadPercent,
    profitMarginPercent: e.profitMarginPercent,
    difficultyMultiplier: e.difficultyMultiplier,
    condition: e.condition,
  }).total, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${ctx.organization.name} → ${ctx.account.name}`}
        title={`What do you want to do${ctx.user.name ? `, ${ctx.user.name.split(" ")[0]}` : ""}?`}
        subtitle="You do not need to learn the whole system. Pick the task you need now; everything else can stay out of the way."
      />

      <section>
        <SectionLabel>Start here</SectionLabel>
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="group h-full border-[#1C3A57] p-4 transition hover:border-[#C97C3D] hover:shadow-card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-[10px] text-[#6D8AA0]">STEP {action.step}</span>
                    <Icon className="h-5 w-5 text-[#6FD6C9]" />
                  </div>
                  <h2 className="mt-5 text-base font-semibold text-slate-800 group-hover:text-signal-600">{action.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{action.text}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-signal-600"><Plus className="h-3.5 w-3.5" /> Go</div>
                </Card>
              </Link>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[10px] text-[#6D8AA0]">TIP · If you are unsure, open Jarvis and ask “What should I do next?” or “Explain this screen.”</p>
      </section>

      <section>
        <SectionLabel>STRATUM Edge</SectionLabel>
        <Card className="mt-2 overflow-hidden border-[#C97C3D] bg-[#081827]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_.9fr]">
            <div className="p-5">
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#E0954F]"><Sparkles className="h-4 w-4" /> Intelligence beyond the drawing</div>
              <h2 className="mt-3 text-xl font-semibold text-[#DCEBF5]">The right-side rail is your quick access to STRATUM Edge.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9FB6C7]">Revision impact, scope gaps, estimate health, bid leveling, procurement risk, historical benchmarking and progress intelligence stay available without crowding the main navigation. Hover or tap any Edge icon to see the gap it covers and open the relevant workspace.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-[0.06em] text-[#6D8AA0]"><span>SCAN</span><span>→</span><span>FINDING</span><span>→</span><span>RECOMMENDATION</span><span>→</span><span>ACTION</span><span>→</span><span className="text-[#6FD6C9]">STRATUM Edge Verified</span></div>
            </div>
            <div className="relative min-h-[150px] overflow-hidden border-t border-[#1C3A57] bg-[#0B1F32] p-5 lg:border-l lg:border-t-0">
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(#1C3A57_1px,transparent_1px),linear-gradient(90deg,#1C3A57_1px,transparent_1px)] [background-size:24px_24px]" />
              <div className="relative grid grid-cols-3 gap-3">
                <div className="border border-[#1C3A57] bg-[#081725]/90 p-3 text-center"><Radar className="mx-auto h-5 w-5 text-[#6FD6C9]"/><div className="mt-2 font-mono text-[8px] uppercase text-[#9FB6C7]">Revision</div></div>
                <div className="border border-[#1C3A57] bg-[#081725]/90 p-3 text-center"><ScanSearch className="mx-auto h-5 w-5 text-[#E0954F]"/><div className="mt-2 font-mono text-[8px] uppercase text-[#9FB6C7]">Scope</div></div>
                <div className="border border-[#1C3A57] bg-[#081725]/90 p-3 text-center"><Sparkles className="mx-auto h-5 w-5 text-[#E8B339]"/><div className="mt-2 font-mono text-[8px] uppercase text-[#9FB6C7]">Jarvis</div></div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionLabel>At a glance</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active projects" value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
          <StatCard label="Open RFIs" value={openRfiCount} icon={<ClipboardList className="h-5 w-5" />} />
          <StatCard label="RFQs" value={rfqCount} icon={<ShoppingCart className="h-5 w-5" />} />
          <StatCard label="Estimate pipeline" value={money(estimatePipeline)} tone="text-emerald-600" icon={<Calculator className="h-5 w-5" />} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between"><SectionLabel>Continue a project</SectionLabel><Link href="/projects" className="text-xs font-semibold text-signal-600">All projects →</Link></div>
          <Card className="overflow-hidden">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No projects yet. <Link href="/projects" className="font-semibold text-signal-600">Create your first project</Link>.</div>
            ) : projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50">
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{p.number ? `#${p.number} · ` : ""}{p._count.rfis} RFI · {p._count.rfqs} RFQ · {p._count.estimates} estimate</div></div>
                <span className="text-xs font-semibold text-signal-600">Open →</span>
              </Link>
            ))}
          </Card>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><SectionLabel>Continue an estimate</SectionLabel><Link href="/costing/estimates" className="text-xs font-semibold text-signal-600">All estimates →</Link></div>
          <Card className="overflow-hidden">
            {estimates.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No estimates yet. <Link href="/costing/estimates/new" className="font-semibold text-signal-600">Create one</Link>.</div>
            ) : estimates.map((e) => {
              const total = calculateEstimate({ lines: e.lineItems, adders: e.adders, laborRate: e.laborRate, overheadPercent: e.overheadPercent, profitMarginPercent: e.profitMarginPercent, difficultyMultiplier: e.difficultyMultiplier, condition: e.condition }).total;
              return <Link key={e.id} href={`/costing/estimates/${e.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-800">{e.name}</div><div className="text-xs text-slate-400">{e.project?.name || "No project"} · {e.status}</div></div><div className="text-right"><div className="font-mono text-sm font-semibold text-emerald-600">{money(total)}</div><div className="text-[10px] text-slate-400">Open →</div></div></Link>;
            })}
          </Card>
        </section>
      </div>

      <Card className="border-[#1C3A57] bg-[#0B1F32] p-4 text-[#DCEBF5]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="font-semibold">Need help deciding?</div><div className="mt-1 text-sm text-[#9FB6C7]">Jarvis can guide you through the software. The product principle is local account data first, external research second when needed, then AI synthesis and recommendations.</div></div>
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-[#6FD6C9]">Jarvis · bottom right</span>
        </div>
      </Card>

      <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#6D8AA0]">{supplierCount} suppliers available in this account</div>
    </div>
  );
}
