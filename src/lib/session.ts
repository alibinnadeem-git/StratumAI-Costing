import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Membership, Organization, Role, User } from "@prisma/client";

export const ORG_COOKIE = "stratum_org_id";
export const ACCOUNT_COOKIE = "stratum_account_id";

export type CurrentUser = Pick<User, "id" | "email" | "name" | "systemRole">;
export type ActiveOrgContext = {
  user: CurrentUser;
  organization: Organization;
  role: Role;
  memberships: (Membership & { organization: Organization })[];
};

export type AccountSummary = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

export type AccountMembershipSummary = {
  id: string;
  role: Role;
  userId: string;
  accountId: string;
  createdAt: Date;
  account: AccountSummary;
};

export type ActiveTenantContext = ActiveOrgContext & {
  account: AccountSummary;
  accountRole: Role;
  accountMemberships: AccountMembershipSummary[];
};

type AccountMembershipRow = {
  membershipId: string;
  role: Role;
  userId: string;
  accountId: string;
  createdAt: Date;
  accountName: string;
  accountSlug: string;
  organizationId: string;
};

export async function getMemberships(userId: string) {
  return db.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

async function loadAccountMemberships(userId: string, organizationId: string): Promise<AccountMembershipSummary[]> {
  const rows = await db.$queryRaw<AccountMembershipRow[]>`
    SELECT
      am."id" AS "membershipId",
      am."role" AS "role",
      am."userId" AS "userId",
      am."accountId" AS "accountId",
      am."createdAt" AS "createdAt",
      a."name" AS "accountName",
      a."slug" AS "accountSlug",
      a."organizationId" AS "organizationId"
    FROM "AccountMembership" am
    INNER JOIN "Account" a ON a."id" = am."accountId"
    WHERE am."userId" = ${userId}
      AND a."organizationId" = ${organizationId}
    ORDER BY a."createdAt" ASC, a."name" ASC
  `;

  return rows.map((row) => ({
    id: row.membershipId,
    role: row.role,
    userId: row.userId,
    accountId: row.accountId,
    createdAt: row.createdAt,
    account: {
      id: row.accountId,
      name: row.accountName,
      slug: row.accountSlug,
      organizationId: row.organizationId,
    },
  }));
}

async function ensureMainAccountMembership(
  userId: string,
  organizationId: string,
  role: Role,
): Promise<AccountMembershipSummary[]> {
  let accounts = await loadAccountMemberships(userId, organizationId);
  if (accounts.length > 0) return accounts;

  const existing = await db.$queryRaw<AccountSummary[]>`
    SELECT "id", "name", "slug", "organizationId"
    FROM "Account"
    WHERE "organizationId" = ${organizationId}
      AND "slug" = 'main'
    LIMIT 1
  `;

  const accountId = existing[0]?.id ?? `acct_${randomUUID().replaceAll("-", "")}`;
  if (!existing[0]) {
    await db.$executeRaw`
      INSERT INTO "Account" ("id", "name", "slug", "organizationId", "createdAt")
      VALUES (${accountId}, 'Main Account', 'main', ${organizationId}, CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId", "slug") DO NOTHING
    `;
  }

  const resolved = await db.$queryRaw<AccountSummary[]>`
    SELECT "id", "name", "slug", "organizationId"
    FROM "Account"
    WHERE "organizationId" = ${organizationId}
      AND "slug" = 'main'
    LIMIT 1
  `;
  const resolvedAccountId = resolved[0]?.id;
  if (!resolvedAccountId) throw new Error("Unable to initialize tenant account.");

  await db.$executeRaw`
    INSERT INTO "AccountMembership" ("id", "role", "createdAt", "userId", "accountId")
    VALUES (${`am_${randomUUID().replaceAll("-", "")}`}, CAST(${role} AS "Role"), CURRENT_TIMESTAMP, ${userId}, ${resolvedAccountId})
    ON CONFLICT ("userId", "accountId") DO NOTHING
  `;

  accounts = await loadAccountMemberships(userId, organizationId);
  return accounts;
}

export async function requireOrgContext(): Promise<ActiveOrgContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [memberships, dbUser] = await Promise.all([
    getMemberships(session.user.id),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, systemRole: true },
    }),
  ]);

  if (!dbUser) redirect("/login");
  if (memberships.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organizationId === preferredOrgId) ?? memberships[0]!;

  return {
    user: dbUser,
    organization: active.organization,
    role: active.role,
    memberships,
  };
}

export async function requireTenantContext(): Promise<ActiveTenantContext> {
  const orgContext = await requireOrgContext();
  const accountMemberships = await ensureMainAccountMembership(
    orgContext.user.id,
    orgContext.organization.id,
    orgContext.role,
  );
  if (accountMemberships.length === 0) throw new Error("No account/tenant membership is available for this organization.");

  const cookieStore = await cookies();
  const preferredAccountId = cookieStore.get(ACCOUNT_COOKIE)?.value;
  const active = accountMemberships.find((m) => m.accountId === preferredAccountId) ?? accountMemberships[0]!;

  return {
    ...orgContext,
    account: active.account,
    accountRole: active.role,
    accountMemberships,
  };
}

export async function requireRole(minRole: Role, ctx?: ActiveOrgContext) {
  const { atLeast } = await import("@/lib/rbac");
  const context = ctx ?? (await requireOrgContext());
  if (!atLeast(context.role, minRole)) {
    throw new Error("Forbidden: insufficient role for this action");
  }
  return context;
}

export async function requireAccountRole(minRole: Role, ctx?: ActiveTenantContext) {
  const { atLeast } = await import("@/lib/rbac");
  const context = ctx ?? (await requireTenantContext());
  if (!atLeast(context.accountRole, minRole)) {
    throw new Error("Forbidden: insufficient account role for this action");
  }
  return context;
}
