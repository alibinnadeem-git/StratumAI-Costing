"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgContext, requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function createProjectAction(formData: FormData) {
  const ctx = await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const number = String(formData.get("number") ?? "").trim() || null;
  if (!name) return;

  const project = await db.project.create({
    data: { name, number, organizationId: ctx.organization.id },
  });
  await logAction({
    organizationId: ctx.organization.id,
    userId: ctx.user.id,
    projectId: project.id,
    action: "project.create",
    detail: `Created project "${name}"`,
  });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function archiveProjectAction(projectId: string) {
  const ctx = await requireRole("ADMIN");
  const project = await db.project.findFirst({ where: { id: projectId, organizationId: ctx.organization.id } });
  if (!project) return;

  await db.project.update({ where: { id: projectId }, data: { archivedAt: new Date() } });
  await logAction({
    organizationId: ctx.organization.id,
    userId: ctx.user.id,
    projectId,
    action: "project.archive",
    detail: `Archived project "${project.name}"`,
  });
  revalidatePath("/projects");
}
