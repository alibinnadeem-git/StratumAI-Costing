"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

export async function createRfqFromEstimateAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const estimateId = String(formData.get("estimateId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const supplierIds = Array.from(new Set(formData.getAll("supplierId").map(String).filter(Boolean)));
  const lineIds = Array.from(new Set(formData.getAll("lineId").map(String).filter(Boolean)));

  if (!estimateId) throw new Error("Estimate is required.");
  if (!title) throw new Error("RFQ title is required.");
  if (!supplierIds.length) throw new Error("Select at least one supplier.");
  if (!lineIds.length) throw new Error("Select at least one estimate line.");

  const estimate = await db.costEstimate.findFirst({
    where: { id: estimateId, accountId: ctx.account.id },
    include: { lineItems: { where: { id: { in: lineIds } } } },
  });
  if (!estimate) throw new Error("Estimate not found in this account.");
  if (!estimate.projectId) throw new Error("Link the estimate to a project before creating an RFQ.");
  if (estimate.lineItems.length !== lineIds.length) throw new Error("One or more estimate lines are outside this estimate.");

  const suppliers = await db.supplier.findMany({
    where: { id: { in: supplierIds }, accountId: ctx.account.id },
    select: { id: true },
  });
  if (suppliers.length !== supplierIds.length) throw new Error("One or more suppliers are outside the active account.");

  const rfq = await db.$transaction(async (tx) => {
    const last = await tx.rfq.findFirst({ where: { projectId: estimate.projectId! }, orderBy: { number: "desc" } });
    const number = (last?.number ?? 0) + 1;
    return tx.rfq.create({
      data: {
        projectId: estimate.projectId!,
        number,
        title,
        dueDate: dueDateRaw ? new Date(`${dueDateRaw}T12:00:00`) : null,
        notes: [
          `Created from EST-${String(estimate.number).padStart(4, "0")} (${estimate.name}).`,
          notes || null,
        ].filter(Boolean).join("\n\n"),
        createdById: ctx.user.id,
        lineItems: {
          create: estimate.lineItems.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            notes: [
              `Estimate source line ${line.id}`,
              line.notes || null,
            ].filter(Boolean).join(" · "),
          })),
        },
        recipients: { create: supplierIds.map((supplierId) => ({ supplierId })) },
      },
    });
  });

  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    projectId: estimate.projectId,
    action: "rfq.create_from_estimate",
    detail: `Created RFQ-${String(rfq.number).padStart(3, "0")} from EST-${String(estimate.number).padStart(4, "0")} with ${lineIds.length} line(s) and ${supplierIds.length} supplier(s)`,
  });

  redirect(`/projects/${estimate.projectId}`);
}
