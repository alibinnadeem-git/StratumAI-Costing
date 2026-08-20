"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function createSupplierAction(formData: FormData) {
  const ctx = await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const contactName = String(formData.get("contactName") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const categories = String(formData.get("categories") ?? "")
    .split(",").map((c) => c.trim()).filter(Boolean);
  if (!name || !email) return;

  await db.supplier.create({
    data: { organizationId: ctx.organization.id, name, email, contactName, phone, categories },
  });
  await logAction({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "supplier.create", detail: `Added supplier "${name}"` });
  revalidatePath("/suppliers");
}

export async function deleteSupplierAction(supplierId: string) {
  const ctx = await requireRole("ADMIN");
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, organizationId: ctx.organization.id } });
  if (!supplier) return;

  await db.supplier.delete({ where: { id: supplierId } });
  await logAction({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "supplier.delete", detail: `Removed supplier "${supplier.name}"` });
  revalidatePath("/suppliers");
}

export async function listSuppliers() {
  const ctx = await requireOrgContext();
  return db.supplier.findMany({ where: { organizationId: ctx.organization.id }, orderBy: { name: "asc" } });
}
