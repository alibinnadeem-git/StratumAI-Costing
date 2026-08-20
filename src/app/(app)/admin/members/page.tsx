import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import Link from "next/link";
import { inviteMemberAction, removeMemberAction, revokeInviteAction } from "../actions";
import RoleSelect from "../RoleSelect";

export default async function MembersPage() {
  const ctx = await requireRole("ADMIN");

  const [memberships, invites] = await Promise.all([
    db.membership.findMany({ where: { organizationId: ctx.organization.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.invite.findMany({ where: { organizationId: ctx.organization.id, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Admin · {ctx.organization.name}</h1>
          <p className="text-sm text-slate-500">Manage members, roles, and access.</p>
        </div>
        <Link href="/admin/audit" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View audit log &rarr;</Link>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white shadow-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Invite a member</h2>
        <form action={inviteMemberAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</span>
            <input name="email" type="email" required placeholder="name@company.com" className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Role</span>
            <select name="role" defaultValue="MEMBER" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="VIEWER">Viewer</option>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              {ctx.role === "OWNER" && <option value="OWNER">Owner</option>}
            </select>
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98]">Invite</button>
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Members ({memberships.length})</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{m.user.name || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.user.email}</td>
                  <td className="px-4 py-2.5">
                    {can.changeRoleTo(ctx.role, m.role) && m.userId !== ctx.user.id ? (
                      <RoleSelect membershipId={m.id} currentRole={m.role} canGrantOwner={ctx.role === "OWNER"} />
                    ) : (
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {can.removeMember(ctx.role, m.role) && m.userId !== ctx.user.id && (
                      <form action={async () => { "use server"; await removeMemberAction(m.id); }}>
                        <button className="text-xs font-semibold text-rose-600 hover:text-rose-700">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {invites.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Pending invites</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 text-slate-700">{inv.email}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{inv.role}</td>
                    <td className="px-4 py-2.5 text-right">
                      <form action={async () => { "use server"; await revokeInviteAction(inv.id); }}>
                        <button className="text-xs font-semibold text-rose-600 hover:text-rose-700">Revoke</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
