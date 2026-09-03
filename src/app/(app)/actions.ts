"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import {
  ACCOUNT_COOKIE,
  ORG_COOKIE,
  getAccountMemberships,
  getMemberships,
  requireRole,
  requireTenantContext,
} from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { bootstrapOrganization } from "@/lib/tenant-bootstrap";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";

export async function switchOrgAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgId = String(formData.get("organizationId") ?? "");
  const memberships = await getMemberships(session.user.id);
  const membership = memberships.find((item) => item.organizationId === orgId);
  if (!membership) throw new Error("Forbidden: organization membership is required.");

  const accountMemberships = await getAccountMemberships(session.user.id, orgId);
  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, orgId, cookieOptions);
  if (accountMemberships[0]) {
    cookieStore.set(ACCOUNT_COOKIE, accountMemberships[0].accountId, cookieOptions);
  } else {
    cookieStore.delete(ACCOUNT_COOKIE);
  }

  await logAction({
    organizationId: orgId,
    accountId: accountMemberships[0]?.accountId,
    userId: session.user.id,
    action: "organization.switch",
    detail: `Switched active organization to ${membership.organization.name}`,
  });

  redirect(accountMemberships[0] ? "/costing/items" : "/organizations");
}

export async function switchAccountAction(formData: FormData) {
  const ctx = await requireTenantContext();
  const accountId = String(formData.get("accountId") ?? "");
  const membership = ctx.accountMemberships.find((item) => item.accountId === accountId);
  if (!membership) throw new Error("Forbidden: account/tenant membership is required.");

  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_COOKIE, accountId, cookieOptions);

  await logAction({
    organizationId: ctx.organization.id,
    accountId,
    userId: ctx.user.id,
    action: "account.switch",
    detail: `Switched active account/tenant to ${membership.account.name}`,
  });

  redirect("/costing/items");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function createOrganizationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Organization name is required.");

  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await db.organization.findUnique({ where: { slug } })) slug = `${base}-${n++}`;

  const result = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name, slug } });
    await tx.membership.create({ data: { userId: session.user.id!, organizationId: organization.id, role: "OWNER" } });
    const account = await bootstrapOrganization(tx, organization.id);
    await tx.accountMembership.create({ data: { userId: session.user.id!, accountId: account.id, role: "OWNER" } });
    return { organization, account };
  });

  await logAction({ organizationId: result.organization.id, accountId: result.account.id, userId: session.user.id, action: "organization.create", detail: `Created organization ${name} with Main Account tenant` });
  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, result.organization.id, cookieOptions);
  cookieStore.set(ACCOUNT_COOKIE, result.account.id, cookieOptions);
  redirect("/costing/items");
}

export async function createAccountAction(formData: FormData) {
  const ctx = await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Account name is required.");

  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await db.account.findFirst({ where: { organizationId: ctx.organization.id, slug } })) slug = `${base}-${n++}`;

  const account = await db.$transaction(async (tx) => {
    const created = await tx.account.create({ data: { organizationId: ctx.organization.id, name, slug } });
    await tx.accountMembership.create({ data: { userId: ctx.user.id, accountId: created.id, role: "OWNER" } });
    await bootstrapOrganization(tx, ctx.organization.id, created.id);
    return created;
  });

  await logAction({ organizationId: ctx.organization.id, accountId: account.id, userId: ctx.user.id, action: "account.create", detail: `Created account/tenant ${account.name}` });
  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_COOKIE, account.id, cookieOptions);
  revalidatePath("/organizations");
  redirect("/costing/items");
}

export async function updateAccountAction(formData: FormData) {
  const ctx = await requireRole("ADMIN");
  const accountId = String(formData.get("accountId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const account = await db.account.findFirst({ where: { id: accountId, organizationId: ctx.organization.id } });
  if (!account) throw new Error("Account not found in this organization.");
  if (!name) throw new Error("Account name is required.");

  const updated = await db.account.update({ where: { id: account.id }, data: { name } });
  await logAction({ organizationId: ctx.organization.id, accountId: account.id, userId: ctx.user.id, action: "account.update", detail: `Renamed account/tenant to ${updated.name}` });
  revalidatePath("/organizations");
}

export async function deleteAccountAction(formData: FormData) {
  const ctx = await requireRole("OWNER");
  const accountId = String(formData.get("accountId") ?? "");
  const account = await db.account.findFirst({ where: { id: accountId, organizationId: ctx.organization.id } });
  if (!account) return;
  if (account.slug === "main") throw new Error("The Main Account cannot be deleted.");

  const [projects, suppliers, items, estimates, jobCosts, quotes] = await Promise.all([
    db.project.count({ where: { accountId } }),
    db.supplier.count({ where: { accountId } }),
    db.costItem.count({ where: { accountId } }),
    db.costEstimate.count({ where: { accountId } }),
    db.jobCostEntry.count({ where: { accountId } }),
    db.supplierQuote.count({ where: { accountId } }),
  ]);
  if (projects + suppliers + items + estimates + jobCosts + quotes > 0) {
    throw new Error("This account contains operational data. Move/archive its records before deleting it.");
  }

  await logAction({ organizationId: ctx.organization.id, accountId: account.id, userId: ctx.user.id, action: "account.delete", detail: `Deleted empty account/tenant ${account.name}` });
  await db.account.delete({ where: { id: account.id } });
  const cookieStore = await cookies();
  if (cookieStore.get(ACCOUNT_COOKIE)?.value === account.id) cookieStore.delete(ACCOUNT_COOKIE);
  revalidatePath("/organizations");
  redirect("/organizations");
}
