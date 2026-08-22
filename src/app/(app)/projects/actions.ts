"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccountRole } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function createProjectAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const name = value(formData, "name");
  const number = value(formData, "number") || null;
  if (!name) return;

  const project = await db.project.create({
    data: { name, number, organizationId: ctx.organization.id, accountId: ctx.account.id },
  });
  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    projectId: project.id,
    action: "project.create",
    detail: `Created project "${name}"`,
  });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const projectId = value(formData, "projectId");
  const project = await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } });
  if (!project) throw new Error("Project not found in this account.");

  const name = value(formData, "name") || project.name;
  const number = value(formData, "number") || null;
  await db.project.update({ where: { id: project.id }, data: { name, number } });
  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    projectId: project.id,
    action: "project.update",
    detail: `Updated project "${project.name}"`,
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
}

export async function archiveProjectAction(projectId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const project = await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } });
  if (!project) return;
  await db.project.update({ where: { id: projectId }, data: { archivedAt: new Date() } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "project.archive", detail: `Archived project "${project.name}"` });
  revalidatePath("/projects");
}

export async function restoreProjectAction(projectId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const project = await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } });
  if (!project) return;
  await db.project.update({ where: { id: project.id }, data: { archivedAt: null } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId: project.id, action: "project.restore", detail: `Restored project "${project.name}"` });
  revalidatePath("/projects");
}

export async function deleteProjectAction(projectId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const project = await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } });
  if (!project) return;
  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    projectId: project.id,
    action: "project.delete",
    detail: `Permanently deleted project "${project.name}"`,
  });
  await db.project.delete({ where: { id: project.id } });
  revalidatePath("/projects");
  redirect("/projects");
}
