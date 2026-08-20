import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, PageHeader, StatCard } from "@/components/ui";

export default async function PlatformAdminPage(){
  const ctx=await requireOrgContext(); if(ctx.user.systemRole!=="SUPER_ADMIN") notFound();
  const [orgs,userCount,projectCount,estimateCount]=await Promise.all([
    db.organization.findMany({include:{_count:{select:{memberships:true,projects:true,costItems:true,estimates:true,suppliers:true}}},orderBy:{createdAt:"desc"},take:250}),
    db.user.count(), db.project.count(), db.costEstimate.count(),
  ]);
  return <div className="space-y-6"><PageHeader eyebrow="Platform administration" title="Tenant Dashboard" subtitle="Cross-organization visibility is restricted to SUPER_ADMIN. Normal organization admins never see another tenant's data." />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatCard label="Organizations" value={orgs.length}/><StatCard label="Users" value={userCount}/><StatCard label="Projects" value={projectCount}/><StatCard label="Estimates" value={estimateCount}/></div>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="min-w-[800px] w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-2.5">Organization</th><th className="px-4 py-2.5 text-right">Members</th><th className="px-4 py-2.5 text-right">Projects</th><th className="px-4 py-2.5 text-right">Cost items</th><th className="px-4 py-2.5 text-right">Estimates</th><th className="px-4 py-2.5 text-right">Suppliers</th><th className="px-4 py-2.5">Created</th></tr></thead><tbody>{orgs.map(o=><tr key={o.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3"><div className="font-semibold text-slate-800">{o.name}</div><div className="font-mono text-xs text-slate-400">{o.slug} · {o.id}</div></td><td className="px-4 py-3 text-right font-mono">{o._count.memberships}</td><td className="px-4 py-3 text-right font-mono">{o._count.projects}</td><td className="px-4 py-3 text-right font-mono">{o._count.costItems}</td><td className="px-4 py-3 text-right font-mono">{o._count.estimates}</td><td className="px-4 py-3 text-right font-mono">{o._count.suppliers}</td><td className="px-4 py-3 text-xs text-slate-400">{o.createdAt.toLocaleDateString()}</td></tr>)}</tbody></table></div></Card>
  </div>;
}
