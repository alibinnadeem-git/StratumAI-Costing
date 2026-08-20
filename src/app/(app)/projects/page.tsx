import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { atLeast } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createProjectAction } from "./actions";

export default async function ProjectsPage() {
  const ctx = await requireOrgContext();
  const canCreate = atLeast(ctx.role, "ADMIN");

  const projects = await db.project.findMany({
    where: { organizationId: ctx.organization.id, archivedAt: null },
    include: { _count: { select: { rfis: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Projects</h1>
      </div>

      {canCreate && (
        <form action={createProjectAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/80 bg-white shadow-card p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Project name</span>
            <input name="name" required placeholder="Terawatt — Fremont Hub" className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Project #</span>
            <input name="number" placeholder="24-118" className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98]">+ Create project</button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="rounded-xl border border-slate-200/80 bg-white shadow-card px-4 py-3 hover:border-blue-300 hover:shadow-sm">
            <div className="font-medium text-slate-800">{p.name}</div>
            <div className="text-xs text-slate-400">{p.number ? `#${p.number} · ` : ""}{p._count.rfis} RFI{p._count.rfis === 1 ? "" : "s"}</div>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="col-span-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
            No projects yet.
          </p>
        )}
      </div>
    </div>
  );
}
