import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";

export default async function AuditLogPage() {
  const ctx = await requireRole("ADMIN");
  const logs = await db.auditLog.findMany({
    where: { organizationId: ctx.organization.id },
    include: { user: true, project: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Audit log</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5 font-semibold">When</th>
              <th className="px-4 py-2.5 font-semibold">Who</th>
              <th className="px-4 py-2.5 font-semibold">Action</th>
              <th className="px-4 py-2.5 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">{l.user?.name || l.user?.email || "System"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-blue-600">{l.action}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{l.detail}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
