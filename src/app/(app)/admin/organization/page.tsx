import Link from "next/link";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, PageHeader, SectionLabel } from "@/components/ui";
import { updateOrganizationAction } from "../actions";

export default async function OrganizationAdminPage(){
  const ctx=await requireRole("ADMIN");
  const [projectCount,itemCount,estimateCount,supplierCount]=await Promise.all([
    db.project.count({where:{organizationId:ctx.organization.id}}),
    db.costItem.count({where:{organizationId:ctx.organization.id}}),
    db.costEstimate.count({where:{organizationId:ctx.organization.id}}),
    db.supplier.count({where:{organizationId:ctx.organization.id}}),
  ]);
  const isOwner=ctx.role==="OWNER";
  return <div className="space-y-6 max-w-4xl"><PageHeader eyebrow="Tenant settings" title={ctx.organization.name} subtitle="Organization identity and isolation boundary for every project, estimate, rate, supplier, RFI, RFQ and audit event." />
    <Card className="p-5"><SectionLabel>Organization identity</SectionLabel><form action={updateOrganizationAction} className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold text-slate-500">Name</span><input name="name" defaultValue={ctx.organization.name} disabled={!isOwner} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"/></label><label><span className="mb-1 block text-xs font-semibold text-slate-500">Slug</span><input name="slug" defaultValue={ctx.organization.slug} disabled={!isOwner} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"/></label>{isOwner&&<button className="justify-self-start rounded-md bg-signal-600 px-4 py-2 text-xs font-semibold text-white">Save identity</button>}</form>{!isOwner&&<p className="mt-3 text-xs text-slate-400">Only an Owner can rename the organization or change its slug.</p>}</Card>
    <div className="grid gap-3 sm:grid-cols-4">{[["Projects",projectCount],["Cost items",itemCount],["Estimates",estimateCount],["Suppliers",supplierCount]].map(([label,value])=><Card key={String(label)} className="p-4"><div className="text-2xl font-bold text-slate-800">{value}</div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div></Card>)}</div>
    <Card className="p-5"><SectionLabel>Multi-organization access</SectionLabel><p className="mt-2 text-sm text-slate-500">Users may hold different roles in different organizations. Tenant context is resolved server-side before each data operation, rather than relying on a browser filter.</p><Link href="/organizations" className="mt-3 inline-block text-xs font-semibold text-signal-600">Open organization manager →</Link></Card>
  </div>;
}
