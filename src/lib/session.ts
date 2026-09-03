import "server-only";
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

export async function getAccountMemberships(
  userId: string,
  organizationId: string,
): Promise<AccountMembershipSummary[]> {
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
  const accountMemberships = await getAccountMemberships(
    orgContext.user.id,
    orgContext.organization.id,
  );

  // Account membership is an explicit authorization boundary. Reading a tenant
  // context must never create or elevate membership as a side effect.
  if (accountMemberships.length === 0) redirect("/organizations");

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
