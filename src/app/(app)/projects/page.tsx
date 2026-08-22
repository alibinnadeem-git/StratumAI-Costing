import Link from "next/link";
import { requireTenantContext } from "@/lib/session";
import { atLeast } from "@/lib/rbac";
import { db } from "@/lib/db";
import { archiveProjectAction, createProjectAction, deleteProjectAction, restoreProjectAction, updateProjectAction } from "./actions";

export default async function ProjectsPage() {
  const ctx = await requireTenantContext();
  const canManage = atLeast(ctx.accountRole, "ADMIN");

  const projects = await db.project.findMany({
    where: { accountId: ctx.account.id },
    include: { _count: { select: { rfis: true, rfqs: true, estimates: true } } },
    orderBy: { createdAt: "desc" },
  });
  const active = projects.filter((p) => !p.archivedAt);
  const archived = projects.filter((p) => p.archivedAt);

  return <div className="space-y-5">
    <section className="stratum-sheet">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h1 className="stratum-sheet-title">Projects</h1><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[#6D8AA0]">{ctx.organization.name} · {ctx.account.name} · full CRUD</p></div><span className="border border-[#1C3A57] px-2 py-1 font-mono text-[10px] text-[#6FD6C9]">{active.length} ACTIVE</span></div>
      {canManage && <form action={createProjectAction} className="grid gap-3 border-t border-[#1C3A57] pt-4 md:grid-cols-[1fr_180px_auto] md:items-end"><label>Project name<input name="name" required placeholder="Terawatt — Fremont Hub" /></label><label>Project #<input name="number" placeholder="24-118" /></label><button className="btn h-[35px]">+ Create project</button></form>}
    </section>

    <section className="stratum-sheet"><h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[#9FB6C7]">Active projects</h2><div className="table-scroll"><table><thead><tr><th>Project</th><th>Number</th><th className="num">RFIs</th><th className="num">RFQs</th><th className="num">Estimates</th><th>Opened</th>{canManage&&<th>Manage</th>}</tr></thead><tbody>{active.map((project)=><tr key={project.id}><td><Link href={`/projects/${project.id}`} className="text-[#DCEBF5] hover:text-[#E0954F]">{project.name}</Link></td><td>{project.number||"—"}</td><td className="num text-[#6FD6C9]">{project._count.rfis}</td><td className="num text-[#6FD6C9]">{project._count.rfqs}</td><td className="num text-[#6FD6C9]">{project._count.estimates}</td><td className="text-[#6D8AA0]">{project.createdAt.toISOString().slice(0,10)}</td>{canManage&&<td><details><summary className="cursor-pointer text-[#E0954F]">Edit / actions</summary><div className="mt-2 min-w-[280px] space-y-2 border border-[#1C3A57] bg-[#0B1F32] p-3"><form action={updateProjectAction} className="space-y-2"><input type="hidden" name="projectId" value={project.id}/><input name="name" defaultValue={project.name}/><input name="number" defaultValue={project.number||""}/><button className="btn w-full">Save changes</button></form><form action={archiveProjectAction.bind(null,project.id)}><button className="w-full border border-[#E8B339] px-3 py-2 text-xs text-[#E8B339]">Archive</button></form><form action={deleteProjectAction.bind(null,project.id)}><button className="w-full border border-[#E0715C] px-3 py-2 text-xs text-[#E0715C]">Delete permanently</button></form></div></details></td>}</tr>)}</tbody></table></div>{active.length===0&&<div className="empty-state mt-3">No active projects.</div>}</section>

    {archived.length>0&&<section className="stratum-sheet"><h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[#9FB6C7]">Archived projects</h2><div className="space-y-2">{archived.map((project)=><div key={project.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#1C3A57] p-3"><div><div className="text-sm text-[#DCEBF5]">{project.name}</div><div className="font-mono text-[10px] text-[#6D8AA0]">{project.number||"NO NUMBER"}</div></div>{canManage&&<div className="flex gap-2"><form action={restoreProjectAction.bind(null,project.id)}><button className="border border-[#6FD6C9] px-3 py-2 text-xs text-[#6FD6C9]">Restore</button></form><form action={deleteProjectAction.bind(null,project.id)}><button className="border border-[#E0715C] px-3 py-2 text-xs text-[#E0715C]">Delete permanently</button></form></div>}</div>)}</div></section>}
  </div>;
}
