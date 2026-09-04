"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { upsertSupplierLeadTime } from "@/lib/commercial-intelligence";

const parseDate = (value: string) => value ? new Date(`${value}T12:00:00`) : null;

export async function saveSupplierLeadTimeAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const category = String(formData.get("category") ?? "General").trim() || "General";
  const leadTimeDays = Math.max(0, Math.round(Number(formData.get("leadTimeDays") ?? 0)));
  const asOfRaw = String(formData.get("asOf") ?? "").trim();
  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supplier = await db.supplier.findFirst({ where: { id: supplierId, accountId: ctx.account.id } });
  if (!supplier) throw new Error("Supplier not found in this account.");
  if (!Number.isFinite(leadTimeDays)) throw new Error("Lead time must be a valid number.");

  await upsertSupplierLeadTime({
    accountId: ctx.account.id,
    supplierId,
    category,
    leadTimeDays,
    asOf: parseDate(asOfRaw) ?? new Date(),
    validUntil: parseDate(validUntilRaw),
    source,
    notes,
    createdById: ctx.user.id,
  });

  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    action: "supplier.lead_time.update",
    detail: `${supplier.name} · ${category}: ${leadTimeDays} day lead time`,
  });

  revalidatePath("/suppliers/lead-times");
  revalidatePath("/suppliers");
}
