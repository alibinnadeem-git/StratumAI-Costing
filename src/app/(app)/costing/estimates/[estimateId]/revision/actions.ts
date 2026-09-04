"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

export async function createEstimateRevisionAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const sourceEstimateId = String(formData.get("estimateId") ?? "").trim();
  if (!sourceEstimateId) throw new Error("Source estimate is required.");

  const source = await db.costEstimate.findFirst({
    where: { id: sourceEstimateId, accountId: ctx.account.id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      adders: true,
    },
  });
  if (!source) throw new Error("Estimate not found in this account.");

  const revision = await db.$transaction(async (tx) => {
    const max = await tx.costEstimate.aggregate({
      where: { accountId: ctx.account.id },
      _max: { number: true },
    });

    const created = await tx.costEstimate.create({
      data: {
        organizationId: ctx.organization.id,
        accountId: ctx.account.id,
        projectId: source.projectId,
        number: (max._max.number ?? 0) + 1,
        name: `${source.name} — Revision`,
        status: "DRAFT",
        condition: source.condition,
        laborRate: source.laborRate,
        overheadPercent: source.overheadPercent,
        profitMarginPercent: source.profitMarginPercent,
        difficultyMultiplier: source.difficultyMultiplier,
        createdById: ctx.user.id,
        notes: [
          `Revision created from EST-${String(source.number).padStart(4, "0")}.`,
          source.notes || null,
        ].filter(Boolean).join("\n\n"),
        lineItems: {
          create: source.lineItems.map((line) => ({
            costItemId: line.costItemId,
            description: line.description,
            category: line.category,
            quantity: line.quantity,
            unit: line.unit,
            materialCost: line.materialCost,
            laborHoursPerUnit: line.laborHoursPerUnit,
            laborNormal: line.laborNormal,
            laborDifficult: line.laborDifficult,
            laborVeryDifficult: line.laborVeryDifficult,
            notes: line.notes,
            sortOrder: line.sortOrder,
          })),
        },
        adders: {
          create: source.adders.map((adder) => ({
            name: adder.name,
            type: adder.type,
            appliesTo: adder.appliesTo,
            amount: adder.amount,
          })),
        },
      },
    });

    await tx.$executeRaw`
      INSERT INTO "EstimateRevisionLink" ("id", "accountId", "parentEstimateId", "childEstimateId", "createdById", "createdAt")
      VALUES (${`rev_${randomUUID().replaceAll("-", "")}`}, ${ctx.account.id}, ${source.id}, ${created.id}, ${ctx.user.id}, CURRENT_TIMESTAMP)
    `;

    return created;
  });

  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    projectId: source.projectId,
    action: "cost.estimate.revision_create",
    detail: `Created EST-${String(revision.number).padStart(4, "0")} as a draft revision of EST-${String(source.number).padStart(4, "0")}`,
  });

  redirect(`/costing/estimates/${revision.id}/compare`);
}
