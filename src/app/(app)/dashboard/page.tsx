import Link from "next/link";
import { AlertTriangle, Calculator, CircleCheck, CircleDot, FileSpreadsheet, FolderOpen, ShoppingCart, Truck } from "lucide-react";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";
import { Card, PageHeader, SectionLabel, StatCard } from "@/components/ui";

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const [projects,rfiCounts,recentRfis,overdue,estimates,supplierCount,rfqCount,costItemCount] = await Promise.all([
    db.project.findMany({ where:{organizationId:ctx.organization.id,archivedAt:null}, include:{_count:{select:{rfis:true,rfqs:true,estimates:true}}}, orderBy:{createdAt:"desc"} }),
    db.rfi.groupBy({ by:["status"], where:{project:{organizationId:ctx.organization.id}}, _count:true }),
    db.rfi.findMany({ where:{project:{organizationId:ctx.organization.id}}, include:{project:true}, orderBy:{createdAt:"desc"}, take:6 }),
    db.rfi.count({ where:{project:{organizationId:ctx.organization.id},status:"OPEN",dateNeeded:{lt:new Date()}} }),
    db.costEstimate.findMany({ where:{organizationId:ctx.organization.id,status:{not:"ARCHIVED"}}, include:{lineItems:true,adders:true,project:true}, orderBy:{updatedAt:"desc"}, take:50 }),
    db.supplier.count({where:{organizationId:ctx.organization.id}}),
    db.rfq.count({where:{project:{organizationId:ctx.organization.id}}}),
    db.costItem.count({where:{organizationId:ctx.organization.id}}),
  ]);
  const countOf=(s:string)=>rfiCounts.find(c=>c.status===s)?._count??0;
  const estimatePipeline=estimates.reduce((sum,e)=>sum+calculateEstimate({lines:e.lineItems,adders:e.adders,laborRate:e.laborRate,overheadPercent:e.overheadPercent,profitMarginPercent:e.profitMarginPercent,difficultyMultiplier:e.difficultyMultiplier,condition:e.condition}).total,0);

  return <div className="space-y-8">
    <PageHeader eyebrow={ctx.organization.name} title={`Welcome back, ${ctx.user.name||ctx.user.email}`} subtitle={`${projects.length} active project${projects.length===1?"":"s"} · tenant role ${ctx.role}`} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
      <StatCard label="Open RFIs" value={countOf("OPEN")} tone="text-amber-500" icon={<CircleDot className="h-5 w-5"/>}/>
      <StatCard label="Answered" value={countOf("ANSWERED")} tone="text-emerald-600" icon={<CircleCheck className="h-5 w-5"/>}/>
      <StatCard label="Overdue" value={overdue} tone="text-rose-600" icon={<AlertTriangle className="h-5 w-5"/>}/>
      <StatCard label="RFQs" value={rfqCount} icon={<ShoppingCart className="h-5 w-5"/>}/>
      <StatCard label="Estimates" value={estimates.length} tone="text-signal-600" icon={<FileSpreadsheet className="h-5 w-5"/>}/>
      <StatCard label="Bid pipeline" value={money(estimatePipeline)} tone="text-emerald-600" icon={<Calculator className="h-5 w-5"/>}/>
      <StatCard label="Cost items" value={costItemCount} icon={<Calculator className="h-5 w-5"/>}/>
      <StatCard label="Suppliers" value={supplierCount} icon={<Truck className="h-5 w-5"/>}/>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <div><div className="mb-2 flex items-center justify-between"><SectionLabel>Projects</SectionLabel><Link href="/projects" className="text-xs font-semibold text-signal-600">View all →</Link></div><div className="grid gap-3 sm:grid-cols-2">{projects.slice(0,6).map(p=><Link key={p.id} href={`/projects/${p.id}`}><Card className="group flex items-center gap-3 px-4 py-3.5 hover:border-signal-300 hover:shadow-card-hover"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400 group-hover:bg-signal-50 group-hover:text-signal-600"><FolderOpen className="h-4.5 w-4.5"/></span><div className="min-w-0"><div className="truncate font-medium text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{p.number?`#${p.number} · `:""}{p._count.rfis} RFI · {p._count.rfqs} RFQ · {p._count.estimates} estimate</div></div></Card></Link>)}{projects.length===0&&<Card className="col-span-2 border-dashed px-4 py-8 text-center text-sm text-slate-400">No projects yet.</Card>}</div></div>

      <div><div className="mb-2 flex items-center justify-between"><SectionLabel>Recent estimates</SectionLabel><Link href="/costing/estimates" className="text-xs font-semibold text-signal-600">Costing →</Link></div><Card className="overflow-hidden">{estimates.slice(0,6).map(e=>{const total=calculateEstimate({lines:e.lineItems,adders:e.adders,laborRate:e.laborRate,overheadPercent:e.overheadPercent,profitMarginPercent:e.profitMarginPercent,difficultyMultiplier:e.difficultyMultiplier,condition:e.condition}).total;return <Link key={e.id} href={`/costing/estimates/${e.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-800">EST-{String(e.number).padStart(4,"0")} · {e.name}</div><div className="text-xs text-slate-400">{e.project?.name||"Unlinked"} · {e.status}</div></div><div className="font-mono text-sm font-semibold text-emerald-600">{money(total)}</div></Link>})}{estimates.length===0&&<div className="p-8 text-center text-sm text-slate-400">No estimates yet. <Link href="/costing/estimates/new" className="font-semibold text-signal-600">Create one</Link>.</div>}</Card></div>
    </div>

    <div><SectionLabel>Recent RFIs</SectionLabel><Card className="mt-2 overflow-hidden">{recentRfis.length===0?<p className="px-4 py-6 text-center text-sm text-slate-400">No RFIs logged yet.</p>:<table className="w-full text-left text-sm"><tbody>{recentRfis.map(r=><tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"><td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-400">RFI-{String(r.number).padStart(3,"0")}</td><td className="px-4 py-2.5"><Link href={`/projects/${r.projectId}`} className="font-medium text-slate-700 hover:text-signal-600">{r.subject}</Link><div className="text-xs text-slate-400">{r.project.name}</div></td><td className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-slate-500">{r.status}</td></tr>)}</tbody></table>}</Card></div>
  </div>;
}
