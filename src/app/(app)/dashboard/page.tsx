import Link from "next/link";
import { AlertTriangle, ArrowRight, Calculator, CheckCircle2, ClipboardList, Clock3, FolderOpen, Plus, ReceiptText, Search, ShoppingCart, Sparkles } from "lucide-react";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";
import { Card, PageHeader, SectionLabel, StatCard } from "@/components/ui";

const QUICK_START = [
  { href: "/costing/estimates/new", title: "Estimate", text: "Price a new job or scope.", icon: ReceiptText },
  { href: "/projects", title: "Project", text: "Open or create project work.", icon: FolderOpen },
  { href: "/costing/quotes", title: "Supplier quote", text: "Capture current market pricing.", icon: ShoppingCart },
];

export default async function DashboardPage() {
  const ctx = await requireTenantContext();
  const accountId = ctx.account.id;
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [projects, estimates, supplierCount, rfqCount, openRfiCount, highPriorityRfis, overdueRfqs, expiringQuotes] = await Promise.all([
    db.project.findMany({ where: { accountId, archivedAt: null }, include: { _count: { select: { rfis: true, rfqs: true, estimates: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.costEstimate.findMany({ where: { accountId, status: { not: "ARCHIVED" } }, include: { lineItems: true, adders: true, project: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.supplier.count({ where: { accountId } }),
    db.rfq.count({ where: { project: { accountId } } }),
    db.rfi.count({ where: { project: { accountId }, status: "OPEN" } }),
    db.rfi.findMany({ where: { project: { accountId }, status: "OPEN", priority: "HIGH" }, include: { project: true }, orderBy: { dateNeeded: "asc" }, take: 4 }),
    db.rfq.findMany({ where: { project: { accountId }, status: { not: "CLOSED" }, dueDate: { lt: now } }, include: { project: true }, orderBy: { dueDate: "asc" }, take: 4 }),
    db.supplierQuote.findMany({ where: { accountId, validUntil: { gte: now, lte: in14Days } }, include: { supplier: true, project: true }, orderBy: { validUntil: "asc" }, take: 4 }),
  ]);

  const estimatePipeline = estimates.reduce((sum, e) => sum + calculateEstimate({ lines: e.lineItems, adders: e.adders, laborRate: e.laborRate, overheadPercent: e.overheadPercent, profitMarginPercent: e.profitMarginPercent, difficultyMultiplier: e.difficultyMultiplier, condition: e.condition }).total, 0);
  const incompleteEstimates = estimates.filter((e) => e.lineItems.length === 0);
  const attentionCount = highPriorityRfis.length + overdueRfqs.length + expiringQuotes.length + incompleteEstimates.length;

  const attention = [
    ...highPriorityRfis.map((rfi) => ({ key: `rfi-${rfi.id}`, title: `High-priority RFI-${String(rfi.number).padStart(3, "0")}`, detail: `${rfi.project.name} · ${rfi.subject}`, href: `/projects/${rfi.projectId}`, tone: "risk" as const })),
    ...overdueRfqs.map((rfq) => ({ key: `rfq-${rfq.id}`, title: `RFQ-${String(rfq.number).padStart(3, "0")} is overdue`, detail: `${rfq.project.name} · ${rfq.title}`, href: `/projects/${rfq.projectId}`, tone: "risk" as const })),
    ...expiringQuotes.map((quote) => ({ key: `quote-${quote.id}`, title: "Supplier quote expires soon", detail: `${quote.supplier?.name || "Supplier"} · ${quote.description}`, href: "/costing/quotes", tone: "warn" as const })),
    ...incompleteEstimates.map((estimate) => ({ key: `est-${estimate.id}`, title: "Estimate has no line items", detail: estimate.name, href: `/costing/estimates/${estimate.id}`, tone: "warn" as const })),
  ].slice(0, 7);

  const continueEstimate = estimates[0];
  const continueProject = projects[0];

  return <div className="space-y-7">
    <PageHeader eyebrow={`${ctx.organization.name} → ${ctx.account.name}`} title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}${ctx.user.name ? `, ${ctx.user.name.split(" ")[0]}` : ""}.`} subtitle="You should not need to remember where everything lives. Start with what needs attention, continue your work, or use Quick Find ( / )." />

    <section>
      <div className="mb-2 flex items-center justify-between"><SectionLabel>What needs attention</SectionLabel><span className={`font-mono text-[10px] uppercase ${attentionCount ? "text-[#E0954F]" : "text-[#6FD6C9]"}`}>{attentionCount} item{attentionCount === 1 ? "" : "s"}</span></div>
      <Card className="overflow-hidden border-[#1C3A57]">
        {attention.length === 0 ? <div className="flex items-center gap-3 p-5"><span className="flex h-9 w-9 items-center justify-center border border-[#6FD6C9] text-[#6FD6C9]"><CheckCircle2 className="h-4 w-4" /></span><div><div className="text-sm font-semibold text-slate-800">Nothing urgent in this account.</div><div className="mt-0.5 text-xs text-slate-500">STRATUM checked high-priority RFIs, overdue RFQs, expiring quotes and incomplete recent estimates using local account data.</div></div></div> : attention.map((item) => <Link key={item.key} href={item.href} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${item.tone === "risk" ? "border-rose-300 text-rose-600" : "border-amber-300 text-amber-600"}`}>{item.tone === "risk" ? <AlertTriangle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{item.title}</span><span className="block truncate text-xs text-slate-500">{item.detail}</span></span><ArrowRight className="h-4 w-4 text-signal-600" /></Link>)}
      </Card>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[.05em] text-[#6D8AA0]">LOCAL FIRST · This Action Center uses your current account records before any web research or AI reasoning.</p>
    </section>

    <section>
      <SectionLabel>Continue working</SectionLabel>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {continueEstimate ? <Link href={`/costing/estimates/${continueEstimate.id}`}><Card className="group h-full p-4 transition hover:border-[#C97C3D]"><div className="flex items-start justify-between"><ReceiptText className="h-5 w-5 text-[#6FD6C9]"/><span className="font-mono text-[9px] uppercase text-[#6D8AA0]">Estimate</span></div><div className="mt-4 text-base font-semibold text-slate-800">{continueEstimate.name}</div><div className="mt-1 text-xs text-slate-500">{continueEstimate.project?.name || "No project"} · {continueEstimate.status}</div><div className="mt-4 text-xs font-semibold text-signal-600">Continue →</div></Card></Link> : <Card className="p-5 text-sm text-slate-500">No estimate to continue. <Link href="/costing/estimates/new" className="font-semibold text-signal-600">Create one →</Link></Card>}
        {continueProject ? <Link href={`/projects/${continueProject.id}`}><Card className="group h-full p-4 transition hover:border-[#C97C3D]"><div className="flex items-start justify-between"><FolderOpen className="h-5 w-5 text-[#E0954F]"/><span className="font-mono text-[9px] uppercase text-[#6D8AA0]">Project</span></div><div className="mt-4 text-base font-semibold text-slate-800">{continueProject.name}</div><div className="mt-1 text-xs text-slate-500">{continueProject._count.rfis} RFI · {continueProject._count.rfqs} RFQ · {continueProject._count.estimates} estimate</div><div className="mt-4 text-xs font-semibold text-signal-600">Continue →</div></Card></Link> : <Card className="p-5 text-sm text-slate-500">No project to continue. <Link href="/projects" className="font-semibold text-signal-600">Create one →</Link></Card>}
      </div>
    </section>

    <section>
      <div className="mb-2 flex items-center justify-between"><SectionLabel>Quick start</SectionLabel><button type="button" onClick={undefined} className="hidden" /></div>
      <div className="grid gap-3 md:grid-cols-3">
        {QUICK_START.map((action) => { const Icon = action.icon; return <Link key={action.href} href={action.href}><Card className="group h-full p-4 transition hover:border-[#C97C3D]"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#6FD6C9]"/><Plus className="h-4 w-4 text-signal-600"/></div><div className="mt-4 font-semibold text-slate-800">{action.title}</div><div className="mt-1 text-xs text-slate-500">{action.text}</div></Card></Link>; })}
      </div>
      <button type="button" className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.05em] text-[#6FD6C9]" onClick={undefined}><Search className="h-3.5 w-3.5"/> Press / anywhere for Quick Find</button>
    </section>

    <section>
      <SectionLabel>At a glance</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Active projects" value={projects.length} icon={<FolderOpen className="h-5 w-5" />} /><StatCard label="Open RFIs" value={openRfiCount} icon={<ClipboardList className="h-5 w-5" />} /><StatCard label="RFQs" value={rfqCount} icon={<ShoppingCart className="h-5 w-5" />} /><StatCard label="Estimate pipeline" value={money(estimatePipeline)} tone="text-emerald-600" icon={<Calculator className="h-5 w-5" />} /></div>
    </section>

    <Card className="border-[#C97C3D] bg-[#0B1F32] p-4 text-[#DCEBF5]"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-[#E0954F]"/> Need help?</div><div className="mt-1 text-sm text-[#9FB6C7]">Jarvis can explain the current page and STRATUM Edge only highlights intelligence relevant to the work in front of you.</div></div><span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[.07em] text-[#6FD6C9]">{supplierCount} suppliers · / Quick Find</span></div></Card>
  </div>;
}
