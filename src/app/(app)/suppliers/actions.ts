"use server";

import { revalidatePath } from "next/cache";
import { requireAccountRole, requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const categoryList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export async function createSupplierAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const contactName = text(formData, "contactName") || null;
  const phone = text(formData, "phone") || null;
  const categories = categoryList(text(formData, "categories"));
  if (!name || !email) return;

  const supplier = await db.supplier.create({
    data: {
      organizationId: ctx.organization.id,
      accountId: ctx.account.id,
      name,
      email,
      contactName,
      phone,
      categories,
    },
  });
  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    action: "supplier.create",
    detail: `Added supplier "${supplier.name}"`,
  });
  revalidatePath("/suppliers");
}

export async function updateSupplierAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const supplierId = text(formData, "supplierId");
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, accountId: ctx.account.id } });
  if (!supplier) throw new Error("Supplier not found in this account.");

  const name = text(formData, "name") || supplier.name;
  const email = text(formData, "email").toLowerCase() || supplier.email;
  const contactName = text(formData, "contactName") || null;
  const phone = text(formData, "phone") || null;
  const categoriesRaw = text(formData, "categories");

  await db.supplier.update({
    where: { id: supplier.id },
    data: {
      name,
      email,
      contactName,
      phone,
      ...(categoriesRaw ? { categories: categoryList(categoriesRaw) } : {}),
    },
  });
  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    action: "supplier.update",
    detail: `Updated supplier "${supplier.name}"`,
  });
  revalidatePath("/suppliers");
}

export async function deleteSupplierAction(supplierId: string) {
  const ctx = await requireAccountRole("ADMIN");
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, accountId: ctx.account.id } });
  if (!supplier) return;

  await db.supplier.delete({ where: { id: supplierId } });
  await logAction({
    organizationId: ctx.organization.id,
    accountId: ctx.account.id,
    userId: ctx.user.id,
    action: "supplier.delete",
    detail: `Removed supplier "${supplier.name}"`,
  });
  revalidatePath("/suppliers");
}

export async function listSuppliers() {
  const ctx = await requireTenantContext();
  return db.supplier.findMany({ where: { accountId: ctx.account.id }, orderBy: { name: "asc" } });
}
