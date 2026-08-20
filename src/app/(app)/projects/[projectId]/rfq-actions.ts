"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { parseBluebeamMarkupsCsv } from "@/lib/csv";

async function loadProjectInOrg(projectId: string, organizationId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, organizationId } });
  if (!project) throw new Error("Project not found in this organization.");
  return project;
}

export async function importTakeoffAction(projectId: string, fileName: string, csvText: string) {
  const ctx = await requireOrgContext();
  if (!can.importTakeoff(ctx.role)) throw new Error("Forbidden");
  await loadProjectInOrg(projectId, ctx.organization.id);

  const parsed = parseBluebeamMarkupsCsv(csvText);
  if (parsed.length === 0) throw new Error("No rows found — check this is a Bluebeam Markups List export with a Subject column.");

  const imp = await db.takeoffImport.create({
    data: {
      projectId,
      fileName,
      importedById: ctx.user.id,
      items: {
        create: parsed.map((r) => ({
          subject: r.subject,
          count: r.count,
          length: r.length,
          area: r.area,
          description: r.subject, // seed the supplier-facing description with the raw subject; editable on review
        })),
      },
    },
    include: { items: true },
  });

  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId,
    action: "takeoff.import", detail: `Imported ${parsed.length} line(s) from "${fileName}"`,
  });
  revalidatePath(`/projects/${projectId}`);
  return imp.id;
}

export async function updateTakeoffItemAction(
  projectId: string, itemId: string, patch: { description?: string; unit?: string; count?: number | null }
) {
  const ctx = await requireOrgContext();
  if (!can.importTakeoff(ctx.role)) throw new Error("Forbidden");
  await loadProjectInOrg(projectId, ctx.organization.id);

  await db.takeoffItem.update({ where: { id: itemId }, data: patch });
  revalidatePath(`/projects/${projectId}`);
}

export async function createRfqAction(projectId: string, input: {
  title: string;
  dueDate?: string;
  notes?: string;
  supplierIds: string[];
  lineItems: { description: string; quantity: number; unit: string; notes?: string; takeoffItemId?: string }[];
}) {
  const ctx = await requireOrgContext();
  if (!can.createRfq(ctx.role)) throw new Error("Forbidden");
  await loadProjectInOrg(projectId, ctx.organization.id);

  if (!input.title.trim()) throw new Error("Title is required.");
  if (input.lineItems.length === 0) throw new Error("Add at least one line item.");
  if (input.supplierIds.length === 0) throw new Error("Select at least one supplier.");

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
      lineItems: { create: input.lineItems.map((li) => ({
        description: li.description, quantity: li.quantity, unit: li.unit || "EA",
        notes: li.notes || null, takeoffItemId: li.takeoffItemId || null,
      })) },
      recipients: { create: input.supplierIds.map((supplierId) => ({ supplierId })) },
    },
  });

  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId,
    action: "rfq.create", detail: `Created RFQ-${String(number).padStart(3, "0")}: ${rfq.title} (${input.lineItems.length} line items, ${input.supplierIds.length} supplier(s))`,
  });
  revalidatePath(`/projects/${projectId}`);
  return rfq.id;
}

export async function deleteRfqAction(projectId: string, rfqId: string) {
  const ctx = await requireRole("ADMIN");
  const rfq = await db.rfq.findFirst({ where: { id: rfqId, projectId, project: { organizationId: ctx.organization.id } } });
  if (!rfq) throw new Error("RFQ not found.");

  await db.rfq.delete({ where: { id: rfqId } });
  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId,
    action: "rfq.delete", detail: `Deleted RFQ-${String(rfq.number).padStart(3, "0")}: ${rfq.title}`,
  });
  revalidatePath(`/projects/${projectId}`);
}
