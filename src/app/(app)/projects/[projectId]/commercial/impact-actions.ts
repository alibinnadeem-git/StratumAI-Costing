"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { upsertRfiCommercialImpact } from "@/lib/commercial-intelligence";

const num = (value: FormDataEntryValue | null, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function saveRfiCommercialImpactAction(projectId: string, formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const rfiId = String(formData.get("rfiId") ?? "").trim();
  const classificationRaw = String(formData.get("classification") ?? "POTENTIAL").trim();
  const classification = (["NONE", "POTENTIAL", "CONFIRMED"] as const).includes(classificationRaw as "NONE" | "POTENTIAL" | "CONFIRMED")
    ? classificationRaw as "NONE" | "POTENTIAL" | "CONFIRMED"
    : "POTENTIAL";

  const rfi = await db.rfi.findFirst({ where: { id: rfiId, projectId, project: { accountId: ctx.account.id } } });
  if (!rfi) throw new Error("RFI not found in this project/account.");

  const costImpact = Math.max(0, num(formData.get("costImpact")));
  const scheduleDays = Math.max(0, Math.round(num(formData.get("scheduleDays"))));
  const laborHoursImpact = Math.max(0, num(formData.get("laborHoursImpact")));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await upsertRfiCommercialImpact({
    accountId: ctx.account.id,
    rfiId,
    classification,
    costImpact,
    scheduleDays,
    laborHoursImpact,
    notes,
    createdById: ctx.user.id,
  });

  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    projectId,
    action: "rfi.commercial_impact.update",
    detail: `RFI-${String(rfi.number).padStart(3, "0")} ${classification} impact: $${costImpact.toFixed(2)}, ${scheduleDays} day(s), ${laborHoursImpact.toFixed(2)} labor hr`,
  });

  revalidatePath(`/projects/${projectId}/commercial`);
}
