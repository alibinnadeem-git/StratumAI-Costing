"use server";

import { revalidatePath } from "next/cache";
import { requireAccountRole, requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { parseBluebeamMarkupsCsv } from "@/lib/csv";
import type { RfqStatus } from "@prisma/client";

async function loadProjectInAccount(projectId: string, accountId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, accountId } });
  if (!project) throw new Error("Project not found in this account.");
  return project;
}

export async function importTakeoffAction(projectId: string, fileName: string, csvText: string) {
  const ctx = await requireTenantContext();
  if (!can.importTakeoff(ctx.accountRole)) throw new Error("Forbidden");
  await loadProjectInAccount(projectId, ctx.account.id);

  const parsed = parseBluebeamMarkupsCsv(csvText);
  if (parsed.length === 0) throw new Error("No rows found — check this is a Bluebeam Markups List export with a Subject column.");

  const imp = await db.takeoffImport.create({
    data: {
      projectId,
      fileName,
      importedById: ctx.user.id,
      items: {
        create: parsed.map((row) => ({
          subject: row.subject,
          count: row.count,
          length: row.length,
          area: row.area,
          description: row.subject,
        })),
      },
    },
    include: { items: true },
  });

  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "takeoff.import", detail: `Imported ${parsed.length} line(s) from "${fileName}"` });
  revalidatePath(`/projects/${projectId}`);
  return imp.id;
}

export async function updateTakeoffItemAction(projectId: string, itemId: string, patch: { description?: string; unit?: string; count?: number | null }) {
  const ctx = await requireTenantContext();
  if (!can.importTakeoff(ctx.accountRole)) throw new Error("Forbidden");
  await loadProjectInAccount(projectId, ctx.account.id);

  const item = await db.takeoffItem.findFirst({ where: { id: itemId, takeoffImport: { projectId, project: { accountId: ctx.account.id } } } });
  if (!item) throw new Error("Takeoff item not found in this account.");
  await db.takeoffItem.update({ where: { id: item.id }, data: patch });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "takeoff.item.update", detail: `Updated takeoff item ${item.subject}` });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTakeoffItemAction(projectId: string, itemId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const item = await db.takeoffItem.findFirst({ where: { id: itemId, takeoffImport: { projectId, project: { accountId: ctx.account.id } } } });
  if (!item) return;
  await db.takeoffItem.delete({ where: { id: item.id } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "takeoff.item.delete", detail: `Deleted takeoff item ${item.subject}` });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTakeoffImportAction(projectId: string, importId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const takeoff = await db.takeoffImport.findFirst({ where: { id: importId, projectId, project: { accountId: ctx.account.id } } });
  if (!takeoff) return;
  await db.takeoffImport.delete({ where: { id: takeoff.id } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "takeoff.delete", detail: `Deleted takeoff import ${takeoff.fileName || takeoff.id}` });
  revalidatePath(`/projects/${projectId}`);
}

export async function createRfqAction(projectId: string, input: {
  title: string;
  dueDate?: string;
  notes?: string;
  supplierIds: string[];
  lineItems: { description: string; quantity: number; unit: string; notes?: string; takeoffItemId?: string }[];
}) {
  const ctx = await requireTenantContext();
  if (!can.createRfq(ctx.accountRole)) throw new Error("Forbidden");
  await loadProjectInAccount(projectId, ctx.account.id);

  if (!input.title.trim()) throw new Error("Title is required.");
  if (input.lineItems.length === 0) throw new Error("Add at least one line item.");
  if (input.supplierIds.length === 0) throw new Error("Select at least one supplier.");

  const validSuppliers = await db.supplier.findMany({ where: { id: { in: input.supplierIds }, accountId: ctx.account.id }, select: { id: true } });
  if (validSuppliers.length !== new Set(input.supplierIds).size) throw new Error("One or more suppliers are outside the active account.");

  const takeoffIds = input.lineItems.map((line) => line.takeoffItemId).filter((id): id is string => Boolean(id));
  if (takeoffIds.length) {
    const validTakeoffs = await db.takeoffItem.count({ where: { id: { in: takeoffIds }, takeoffImport: { projectId, project: { accountId: ctx.account.id } } } });
    if (validTakeoffs !== new Set(takeoffIds).size) throw new Error("One or more takeoff items are outside the active project/account.");
  }

  const last = await db.rfq.findFirst({ where: { projectId }, orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;

  const rfq = await db.rfq.create({
    data: {
      projectId,
      number,
      title: input.title.trim(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes || null,
      createdById: ctx.user.id,
      lineItems: { create: input.lineItems.map((line) => ({ description: line.description, quantity: line.quantity, unit: line.unit || "EA", notes: line.notes || null, takeoffItemId: line.takeoffItemId || null })) },
      recipients: { create: input.supplierIds.map((supplierId) => ({ supplierId })) },
    },
  });

  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "rfq.create", detail: `Created RFQ-${String(number).padStart(3, "0")}: ${rfq.title} (${input.lineItems.length} line items, ${input.supplierIds.length} supplier(s))` });
  revalidatePath(`/projects/${projectId}`);
  return rfq.id;
}

export async function updateRfqAction(projectId: string, rfqId: string, input: { title?: string; dueDate?: string | null; notes?: string | null; status?: RfqStatus }) {
  const ctx = await requireAccountRole("MEMBER");
  const rfq = await db.rfq.findFirst({ where: { id: rfqId, projectId, project: { accountId: ctx.account.id } } });
  if (!rfq) throw new Error("RFQ not found in this account.");
  await db.rfq.update({
    where: { id: rfq.id },
    data: {
      title: input.title?.trim() || rfq.title,
      dueDate: input.dueDate === undefined ? rfq.dueDate : input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes === undefined ? rfq.notes : input.notes || null,
      status: input.status ?? rfq.status,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "rfq.update", detail: `Updated RFQ-${String(rfq.number).padStart(3, "0")}` });
  revalidatePath(`/projects/${projectId}`);
}

export async function addRfqLineItemAction(projectId: string, rfqId: string, input: { description: string; quantity: number; unit?: string; notes?: string }) {
  const ctx = await requireAccountRole("MEMBER");
  const rfq = await db.rfq.findFirst({ where: { id: rfqId, projectId, project: { accountId: ctx.account.id } } });
  if (!rfq) throw new Error("RFQ not found.");
  if (!input.description.trim()) throw new Error("Description is required.");
  await db.rfqLineItem.create({ data: { rfqId, description: input.description.trim(), quantity: Math.max(0, input.quantity), unit: input.unit || "EA", notes: input.notes || null } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateRfqLineItemAction(projectId: string, lineItemId: string, patch: { description?: string; quantity?: number; unit?: string; notes?: string | null }) {
  const ctx = await requireAccountRole("MEMBER");
  const line = await db.rfqLineItem.findFirst({ where: { id: lineItemId, rfq: { projectId, project: { accountId: ctx.account.id } } } });
  if (!line) throw new Error("RFQ line item not found.");
  await db.rfqLineItem.update({ where: { id: line.id }, data: { description: patch.description?.trim() || line.description, quantity: patch.quantity === undefined ? line.quantity : Math.max(0, patch.quantity), unit: patch.unit || line.unit, notes: patch.notes === undefined ? line.notes : patch.notes || null } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteRfqLineItemAction(projectId: string, lineItemId: string) {
  const ctx = await requireAccountRole("MEMBER");
  const line = await db.rfqLineItem.findFirst({ where: { id: lineItemId, rfq: { projectId, project: { accountId: ctx.account.id } } } });
  if (!line) return;
  await db.rfqLineItem.delete({ where: { id: line.id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function addRfqRecipientAction(projectId: string, rfqId: string, supplierId: string) {
  const ctx = await requireAccountRole("MEMBER");
  const [rfq, supplier] = await Promise.all([
    db.rfq.findFirst({ where: { id: rfqId, projectId, project: { accountId: ctx.account.id } } }),
    db.supplier.findFirst({ where: { id: supplierId, accountId: ctx.account.id } }),
  ]);
  if (!rfq || !supplier) throw new Error("RFQ or supplier not found in this account.");
  await db.rfqRecipient.upsert({ where: { rfqId_supplierId: { rfqId, supplierId } }, update: {}, create: { rfqId, supplierId } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteRfqRecipientAction(projectId: string, recipientId: string) {
  const ctx = await requireAccountRole("MEMBER");
  const recipient = await db.rfqRecipient.findFirst({ where: { id: recipientId, rfq: { projectId, project: { accountId: ctx.account.id } } } });
  if (!recipient) return;
  await db.rfqRecipient.delete({ where: { id: recipient.id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteRfqAction(projectId: string, rfqId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const rfq = await db.rfq.findFirst({ where: { id: rfqId, projectId, project: { accountId: ctx.account.id } } });
  if (!rfq) throw new Error("RFQ not found.");

  await db.rfq.delete({ where: { id: rfqId } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "rfq.delete", detail: `Deleted RFQ-${String(rfq.number).padStart(3, "0")}: ${rfq.title}` });
  revalidatePath(`/projects/${projectId}`);
}
