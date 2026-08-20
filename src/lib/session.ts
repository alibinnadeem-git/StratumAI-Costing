import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Membership, Organization, Role, User } from "@prisma/client";
import { bootstrapOrganization } from "@/lib/tenant-bootstrap";

export const ORG_COOKIE = "stratum_org_id";

export type CurrentUser = Pick<User, "id" | "email" | "name" | "systemRole">;
export type ActiveOrgContext = {
  user: CurrentUser;
  organization: Organization;
  role: Role;
  memberships: (Membership & { organization: Organization })[];
};

export async function getMemberships(userId: string) {
  return db.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireOrgContext(): Promise<ActiveOrgContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [memberships, dbUser] = await Promise.all([
    getMemberships(session.user.id),
    db.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, systemRole: true } }),
  ]);
  if (!dbUser) redirect("/login");
  if (memberships.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organizationId === preferredOrgId) ?? memberships[0]!;

  const hasCostSettings = await db.costSettings.findUnique({ where: { organizationId: active.organizationId }, select: { id: true } });
  if (!hasCostSettings) {
    await db.$transaction(async (tx) => bootstrapOrganization(tx, active.organizationId));
  }

  return {
    user: dbUser,
    organization: active.organization,
    role: active.role,
    memberships,
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
