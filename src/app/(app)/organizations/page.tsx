import { Building2, Plus, ShieldCheck } from "lucide-react";
import { requireTenantContext } from "@/lib/session";
import { atLeast } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createAccountAction, createOrganizationAction, deleteAccountAction, switchAccountAction, switchOrgAction, updateAccountAction } from "../actions";

export default async function OrganizationsPage() {
  const ctx = await requireTenantContext();
  const canManageOrg = atLeast(ctx.role, "ADMIN");
  const isOwner = atLeast(ctx.role, "OWNER");
  const accounts = await db.account.findMany({
    where: { organizationId: ctx.organization.id },
    include: { _count: { select: { projects: true, suppliers: true, costItems: true, estimates: true, memberships: true } } },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });

  return <div className="space-y-5">
    <section className="stratum-sheet">
      <h1 className="stratum-sheet-title">Organizations & Accounts</h1>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">Multi-org platform → organization → account / tenant → operational records</p>
    </section>

    <section className="stratum-sheet">
      <div className="mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-[#E0954F]"/><h2 className="stratum-sheet-title">Organizations</h2></div>
      <div className="grid gap-3 md:grid-cols-2">{ctx.memberships.map(membership => <div key={membership.id} className={`border p-4 ${membership.organizationId===ctx.organization.id?"border-[#C97C3D] bg-[#C97C3D]/5":"border-[#1C3A57]"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-[#DCEBF5]">{membership.organization.name}</h3><p className="font-mono text-[10px] text-[#6D8AA0]">/{membership.organization.slug}</p></div><span className="stratum-role"><ShieldCheck className="mr-1 inline h-3 w-3"/>{membership.role}</span></div>{membership.organizationId===ctx.organization.id?<div className="mt-4 font-mono text-[10px] text-[#7FCB9B]">ACTIVE ORGANIZATION</div>:<form action={switchOrgAction} className="mt-4"><input type="hidden" name="organizationId" value={membership.organizationId}/><button className="btn small">Switch organization</button></form>}</div>)}</div>
      <div className="mt-4 border-t border-[#1C3A57] pt-4"><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-[#6FD6C9]"/><h3 className="text-sm font-semibold text-[#DCEBF5]">Create another organization</h3></div><p className="mt-1 text-xs text-[#9FB6C7]">You become Owner. A Main Account tenant and its costing baseline are created automatically.</p><form action={createOrganizationAction} className="mt-3 flex gap-2"><input name="name" required placeholder="Organization / company name" className="flex-1"/><button className="btn">Create organization</button></form></div>
    </section>

    <section className="stratum-sheet">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="stratum-sheet-title">Accounts / Tenants</h2><p className="mt-1 font-mono text-[10px] text-[#6D8AA0]">Operational workspaces inside {ctx.organization.name}</p></div><span className="tag QUOTE">{accounts.length} ACCOUNT{accounts.length===1?"":"S"}</span></div>
      <div className="table-scroll"><table className="min-w-[820px]"><thead><tr><th>Account</th><th className="num">Members</th><th className="num">Projects</th><th className="num">Cost items</th><th className="num">Estimates</th><th className="num">Suppliers</th><th>Actions</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td className="desc-cell">{account.name}<span className="cat">/{account.slug}{account.id===ctx.account.id?" · ACTIVE":""}</span></td><td className="num">{account._count.memberships}</td><td className="num">{account._count.projects}</td><td className="num">{account._count.costItems}</td><td className="num">{account._count.estimates}</td><td className="num">{account._count.suppliers}</td><td><div className="flex flex-wrap gap-2">{account.id!==ctx.account.id&&<form action={switchAccountAction}><input type="hidden" name="accountId" value={account.id}/><button className="btn small">Open</button></form>}{canManageOrg&&<details><summary className="btn secondary small list-none">Rename</summary><form action={updateAccountAction} className="mt-2 flex gap-1"><input type="hidden" name="accountId" value={account.id}/><input name="name" defaultValue={account.name} className="min-w-[150px]"/><button className="btn small">Save</button></form></details>}{isOwner&&account.slug!=="main"&&<form action={deleteAccountAction}><input type="hidden" name="accountId" value={account.id}/><button className="btn danger small">Delete if empty</button></form>}</div></td></tr>)}</tbody></table></div>
      {canManageOrg&&<div className="mt-4 border-t border-[#1C3A57] pt-4"><h3 className="text-sm font-semibold text-[#DCEBF5]">Create account / tenant</h3><p className="mt-1 text-xs text-[#9FB6C7]">Creates an isolated operational workspace with its own costing settings, catalog baseline, projects and account memberships.</p><form action={createAccountAction} className="mt-3 flex gap-2"><input name="name" required placeholder="e.g. California Operations" className="flex-1"/><button className="btn">Create account</button></form></div>}
    </section>
  </div>;
}
