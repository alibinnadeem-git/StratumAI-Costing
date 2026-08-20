import Link from "next/link";
import { requireRole } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole("ADMIN");
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-500 shadow-card">
        <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">Admin Dashboard</Link>
        <Link href="/admin/members" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">Members & Roles</Link>
        <Link href="/admin/organization" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">Organization</Link>
        <Link href="/admin/audit" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">Audit Log</Link>
        {ctx.user.systemRole === "SUPER_ADMIN" && <Link href="/admin/platform" className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700 hover:bg-amber-100">Platform Tenants</Link>}
      </nav>
      {children}
    </div>
  );
}
