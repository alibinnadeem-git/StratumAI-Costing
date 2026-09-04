"use server";

import { revalidatePath } from "next/cache";
import type { EstimateStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

const ALLOWED: Record<EstimateStatus, EstimateStatus[]> = {
  DRAFT: ["DRAFT", "REVIEW", "ARCHIVED"],
  REVIEW: ["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"],
  APPROVED: ["APPROVED", "SUBMITTED", "SUPERSEDED", "ARCHIVED"],
  SUBMITTED: ["SUBMITTED", "AWARDED", "LOST", "SUPERSEDED", "ARCHIVED"],
  AWARDED: ["AWARDED", "ARCHIVED"],
  LOST: ["LOST", "ARCHIVED"],
  SUPERSEDED: ["SUPERSEDED", "ARCHIVED"],
  ARCHIVED: ["ARCHIVED"],
};

export async function changeEstimateStatusAction(estimateId: string, formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const estimate = await db.costEstimate.findFirst({ where: { id: estimateId, accountId: ctx.account.id } });
  if (!estimate) throw new Error("Estimate not found in this account.");

  const next = String(formData.get("status") ?? "") as EstimateStatus;
  if (!ALLOWED[estimate.status]?.includes(next)) {
    throw new Error(`Illegal estimate status transition: ${estimate.status} → ${next}.`);
  }
  if (next === estimate.status) return;

  await db.costEstimate.update({ where: { id: estimate.id }, data: { status: next } });
  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    projectId: estimate.projectId,
    action: "cost.estimate.status_change",
    detail: `EST-${String(estimate.number).padStart(4, "0")} ${estimate.status} → ${next}`,
  });

  revalidatePath(`/costing/estimates/${estimate.id}`);
  revalidatePath(`/costing/estimates/${estimate.id}/health`);
  revalidatePath("/costing/estimates");
}
