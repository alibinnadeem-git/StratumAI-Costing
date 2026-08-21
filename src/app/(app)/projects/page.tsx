import Link from "next/link";
import { requireTenantContext } from "@/lib/session";
import { atLeast } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createProjectAction } from "./actions";

export default async function ProjectsPage() {
  const ctx = await requireTenantContext();
  const canCreate = atLeast(ctx.accountRole, "ADMIN");

  const projects = await db.project.findMany({
    where: { accountId: ctx.account.id, archivedAt: null },
    include: { _count: { select: { rfis: true, rfqs: true, estimates: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <section className="stratum-sheet">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="stratum-sheet-title">Projects</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">
              {ctx.organization.name} · {ctx.account.name} · account-scoped project operations
            </p>
          </div>
          <span className="border border-[#1C3A57] px-2 py-1 font-mono text-[10px] text-[#6FD6C9]">{projects.length} ACTIVE</span>
        </div>

        {canCreate && (
          <form action={createProjectAction} className="grid gap-3 border-t border-[#1C3A57] pt-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <label>
              Project name
              <input name="name" required placeholder="Terawatt — Fremont Hub" />
            </label>
            <label>
              Project #
              <input name="number" placeholder="24-118" />
            </label>
            <button className="btn h-[35px]">+ Create project</button>
          </form>
        )}
      </section>

      <section className="stratum-sheet">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Number</th>
                <th className="num">RFIs</th>
                <th className="num">RFQs</th>
                <th className="num">Estimates</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td><Link href={`/projects/${project.id}`} className="text-[#DCEBF5] hover:text-[#E0954F]">{project.name}</Link></td>
                  <td className="text-[#9FB6C7]">{project.number || "—"}</td>
                  <td className="num text-[#6FD6C9]">{project._count.rfis}</td>
                  <td className="num text-[#6FD6C9]">{project._count.rfqs}</td>
                  <td className="num text-[#6FD6C9]">{project._count.estimates}</td>
                  <td className="text-[#6D8AA0]">{project.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {projects.length === 0 && <div className="empty-state mt-3">No projects in this account yet.</div>}
      </section>
    </div>
  );
}
