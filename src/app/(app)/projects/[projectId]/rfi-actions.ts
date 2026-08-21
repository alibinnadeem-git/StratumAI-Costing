"use server";

import { revalidatePath } from "next/cache";
import { requireAccountRole, requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { RfiPriority, RfiStatus } from "@prisma/client";

async function loadProjectInAccount(projectId: string, accountId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, accountId } });
  if (!project) throw new Error("Project not found in this account.");
  return project;
}

export async function createRfiAction(projectId: string, input: {
  sheet?: string; location?: string; subject: string; question: string;
  priority: RfiPriority; dateSubmitted?: string; dateNeeded?: string;
  submittedBy?: string; imageDataUrl?: string | null;
}) {
  const ctx = await requireTenantContext();
  if (!can.createRfi(ctx.accountRole)) throw new Error("Forbidden");
  await loadProjectInAccount(projectId, ctx.account.id);
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
    organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId,
    action: "rfi.create", detail: `Logged RFI-${String(number).padStart(3, "0")}: ${rfi.subject}`,
  });
  revalidatePath(`/projects/${projectId}`);
  return rfi.id;
}

export async function updateRfiAction(projectId: string, rfiId: string, input: {
  sheet?: string; location?: string; subject?: string; question?: string; response?: string;
  priority?: RfiPriority; status?: RfiStatus; dateNeeded?: string | null; submittedBy?: string;
}) {
  const ctx = await requireAccountRole("MEMBER");
  await loadProjectInAccount(projectId, ctx.account.id);
  const rfi = await db.rfi.findFirst({ where: { id: rfiId, projectId, project: { accountId: ctx.account.id } } });
  if (!rfi) throw new Error("RFI not found.");

  const nextStatus = input.status ?? rfi.status;
  await db.rfi.update({
    where: { id: rfi.id },
    data: {
      sheet: input.sheet === undefined ? rfi.sheet : input.sheet || null,
      location: input.location === undefined ? rfi.location : input.location || null,
      subject: input.subject?.trim() || rfi.subject,
      question: input.question?.trim() || rfi.question,
      response: input.response === undefined ? rfi.response : input.response || null,
      priority: input.priority ?? rfi.priority,
      status: nextStatus,
      dateNeeded: input.dateNeeded === undefined ? rfi.dateNeeded : input.dateNeeded ? new Date(input.dateNeeded) : null,
      submittedBy: input.submittedBy === undefined ? rfi.submittedBy : input.submittedBy || null,
      dateAnswered: nextStatus === "ANSWERED" ? (rfi.dateAnswered ?? new Date()) : nextStatus === "OPEN" ? null : rfi.dateAnswered,
    },
  });

  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "rfi.update", detail: `Updated RFI-${String(rfi.number).padStart(3, "0")}` });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateRfiStatusAction(projectId: string, rfiId: string, status: RfiStatus, response?: string) {
  return updateRfiAction(projectId, rfiId, { status, response });
}

export async function deleteRfiAction(projectId: string, rfiId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const rfi = await db.rfi.findFirst({ where: { id: rfiId, projectId, project: { accountId: ctx.account.id } } });
  if (!rfi) throw new Error("RFI not found.");

  await db.rfi.delete({ where: { id: rfiId } });
  await logAction({
    organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId,
    action: "rfi.delete", detail: `Deleted RFI-${String(rfi.number).padStart(3, "0")}: ${rfi.subject}`,
  });
  revalidatePath(`/projects/${projectId}`);
}
