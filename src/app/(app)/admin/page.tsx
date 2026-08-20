import Link from "next/link";
import { Building2, Calculator, FileQuestion, FileSpreadsheet, FolderKanban, ShoppingCart, Truck, Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, money } from "@/lib/costing";
import { Card, PageHeader, SectionLabel, StatCard } from "@/components/ui";

export default async function AdminDashboardPage(){
  const ctx=await requireRole("ADMIN");
  const [members,projects,rfis,rfqs,suppliers,costItems,estimates,recentAudit]=await Promise.all([
    db.membership.count({where:{organizationId:ctx.organization.id}}),
    db.project.count({where:{organizationId:ctx.organization.id,archivedAt:null}}),
    db.rfi.count({where:{project:{organizationId:ctx.organization.id}}}),
    db.rfq.count({where:{project:{organizationId:ctx.organization.id}}}),
    db.supplier.count({where:{organizationId:ctx.organization.id}}),
    db.costItem.count({where:{organizationId:ctx.organization.id}}),
    db.costEstimate.findMany({where:{organizationId:ctx.organization.id,status:{not:"ARCHIVED"}},include:{lineItems:true,adders:true},take:100}),
    db.auditLog.findMany({where:{organizationId:ctx.organization.id},include:{user:{select:{name:true,email:true}}},orderBy:{createdAt:"desc"},take:10}),
  ]);
  const estimatePipeline=estimates.reduce((sum,e)=>sum+calculateEstimate({lines:e.lineItems,adders:e.adders,laborRate:e.laborRate,overheadPercent:e.overheadPercent,profitMarginPercent:e.profitMarginPercent,difficultyMultiplier:e.difficultyMultiplier,condition:e.condition}).total,0);
  return <div className="space-y-8"><PageHeader eyebrow={`${ctx.organization.name} · Tenant administration`} title="Admin Dashboard" subtitle="Unified governance for users, projects, RFI/RFQ operations and the estimating database." actions={<Link href="/organizations" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700">Manage organizations</Link>}/>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Members" value={members} icon={<Users className="h-5 w-5"/>}/><StatCard label="Active projects" value={projects} icon={<FolderKanban className="h-5 w-5"/>}/><StatCard label="RFIs" value={rfis} icon={<FileQuestion className="h-5 w-5"/>}/><StatCard label="RFQs" value={rfqs} icon={<ShoppingCart className="h-5 w-5"/>}/><StatCard label="Suppliers" value={suppliers} icon={<Truck className="h-5 w-5"/>}/><StatCard label="Cost items" value={costItems} icon={<Calculator className="h-5 w-5"/>}/><StatCard label="Active estimates" value={estimates.length} icon={<FileSpreadsheet className="h-5 w-5"/>}/><StatCard label="Estimate pipeline" value={money(estimatePipeline)} tone="text-emerald-600" icon={<Building2 className="h-5 w-5"/>}/></div>
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div><SectionLabel>Recent tenant activity</SectionLabel><Card className="mt-2 overflow-hidden">{recentAudit.map(a=><div key={a.id} className="border-b border-slate-100 px-4 py-3 last:border-0"><div className="flex justify-between gap-4"><div><div className="text-sm font-medium text-slate-800">{a.detail||a.action}</div><div className="text-xs text-slate-400">{a.action} · {a.user?.name||a.user?.email||"System"}</div></div><span className="whitespace-nowrap text-xs text-slate-400">{a.createdAt.toLocaleString()}</span></div></div>)}{recentAudit.length===0&&<div className="p-8 text-center text-sm text-slate-400">No audit activity yet.</div>}</Card></div><div><SectionLabel>Administration</SectionLabel><Card className="mt-2 divide-y divide-slate-100">{[["/admin/members","Members & roles","Invite users and control tenant permissions."],["/admin/organization","Organization settings","Tenant identity and workspace configuration."],["/admin/audit","Audit log","Review who changed what and when."],["/costing/settings","Costing governance","Control organization-wide labor and margin defaults."],["/organizations","Multi-org workspace","Create or switch between isolated organizations."]].map(([href,title,desc])=><Link key={href} href={href} className="block p-4 hover:bg-slate-50"><div className="text-sm font-semibold text-slate-800">{title} →</div><div className="mt-1 text-xs text-slate-400">{desc}</div></Link>)}</Card></div></div>
  </div>;
}
