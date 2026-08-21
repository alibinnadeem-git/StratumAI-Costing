"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { ACCOUNT_COOKIE, ORG_COOKIE, getMemberships, requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function switchOrgAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgId = String(formData.get("organizationId") ?? "");
  const memberships = await getMemberships(session.user.id);
  if (!memberships.some((m) => m.organizationId === orgId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, orgId, cookieOptions);
  cookieStore.delete(ACCOUNT_COOKIE);
  redirect("/costing/items");
}

export async function switchAccountAction(formData: FormData) {
  const ctx = await requireTenantContext();
  const accountId = String(formData.get("accountId") ?? "");
  if (!ctx.accountMemberships.some((membership) => membership.accountId === accountId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_COOKIE, accountId, cookieOptions);
  redirect("/costing/items");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function createOrganizationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "organization";
  let slug = base;
  let n = 2;
  while (await db.organization.findUnique({ where: { slug } })) slug = `${base}-${n++}`;

  const accountId = `acct_${randomUUID().replaceAll("-", "")}`;
  const accountMembershipId = `am_${randomUUID().replaceAll("-", "")}`;
  const settingsId = `cs_${randomUUID().replaceAll("-", "")}`;

  const org = await db.$transaction(async (tx) => {
    const created = await tx.organization.create({ data: { name, slug } });
    await tx.membership.create({
      data: { userId: session.user.id!, organizationId: created.id, role: "OWNER" },
    });
    await tx.$executeRaw`
      INSERT INTO "Account" ("id", "name", "slug", "organizationId", "createdAt")
      VALUES (${accountId}, 'Main Account', 'main', ${created.id}, CURRENT_TIMESTAMP)
    `;
    await tx.$executeRaw`
      INSERT INTO "AccountMembership" ("id", "role", "createdAt", "userId", "accountId")
      VALUES (${accountMembershipId}, CAST('OWNER' AS "Role"), CURRENT_TIMESTAMP, ${session.user.id!}, ${accountId})
    `;
    await tx.$executeRaw`
      INSERT INTO "CostSettings" (
        "id", "laborRate", "overheadPercent", "profitMarginPercent", "difficultyMultiplier",
        "defaultCondition", "updatedAt", "organizationId", "accountId"
      ) VALUES (
        ${settingsId}, 95, 12, 15, 1, CAST('NORMAL' AS "EstimateCondition"), CURRENT_TIMESTAMP, ${created.id}, ${accountId}
      )
    `;
    return created;
  });

  await logAction({
    organizationId: org.id,
    accountId,
    userId: session.user.id,
    action: "organization.create",
    detail: `Created organization ${name} with Main Account tenant`,
  });

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, org.id, cookieOptions);
  cookieStore.set(ACCOUNT_COOKIE, accountId, cookieOptions);
  redirect("/costing/items");
}
