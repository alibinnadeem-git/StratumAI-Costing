"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { RfiPriority, RfiStatus } from "@prisma/client";

async function loadProjectInOrg(projectId: string, organizationId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, organizationId } });
  if (!project) throw new Error("Project not found in this organization.");
  return project;
}

export async function createRfiAction(projectId: string, input: {
  sheet?: string; location?: string; subject: string; question: string;
  priority: RfiPriority; dateSubmitted?: string; dateNeeded?: string;
  submittedBy?: string; imageDataUrl?: string | null;
}) {
  const ctx = await requireOrgContext();
  if (!can.createRfi(ctx.role)) throw new Error("Forbidden");
  await loadProjectInOrg(projectId, ctx.organization.id);
  if (!input.subject.trim() || !input.question.trim()) throw new Error("Subject and question are required.");

  const last = await db.rfi.findFirst({ where: { projectId }, orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;

  const rfi = await db.rfi.create({
    data: {
      projectId,
      number,
      sheet: input.sheet || null,
      location: input.location || null,
      subject: input.subject.trim(),
      question: input.question.trim(),
      priority: input.priority,
      dateSubmitted: input.dateSubmitted ? new Date(input.dateSubmitted) : new Date(),
      dateNeeded: input.dateNeeded ? new Date(input.dateNeeded) : null,
      submittedBy: input.submittedBy || ctx.user.name || ctx.user.email,
      imageDataUrl: input.imageDataUrl || null,
      createdById: ctx.user.id,
    },
  });

  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId,
    action: "rfi.create", detail: `Logged RFI-${String(number).padStart(3, "0")}: ${rfi.subject}`,
  });
  revalidatePath(`/projects/${projectId}`);
  return rfi.id;
}

export async function updateRfiStatusAction(projectId: string, rfiId: string, status: RfiStatus, response?: string) {
  const ctx = await requireOrgContext();
  if (!can.createRfi(ctx.role)) throw new Error("Forbidden"); // MEMBER+ can respond/change status
  await loadProjectInOrg(projectId, ctx.organization.id);

  const rfi = await db.rfi.findFirst({ where: { id: rfiId, projectId } });
  if (!rfi) throw new Error("RFI not found.");

  await db.rfi.update({
    where: { id: rfiId },
    data: {
      status,
      response: response ?? rfi.response,
      dateAnswered: status === "ANSWERED" && !rfi.dateAnswered ? new Date() : rfi.dateAnswered,
    },
  });

  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId,
    action: "rfi.status_change", detail: `RFI-${String(rfi.number).padStart(3, "0")} → ${status}`,
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteRfiAction(projectId: string, rfiId: string) {
  const ctx = await requireRole("ADMIN");
  const rfi = await db.rfi.findFirst({ where: { id: rfiId, projectId, project: { organizationId: ctx.organization.id } } });
  if (!rfi) throw new Error("RFI not found.");

  await db.rfi.delete({ where: { id: rfiId } });
  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId,
    action: "rfi.delete", detail: `Deleted RFI-${String(rfi.number).padStart(3, "0")}: ${rfi.subject}`,
  });
  revalidatePath(`/projects/${projectId}`);
}
