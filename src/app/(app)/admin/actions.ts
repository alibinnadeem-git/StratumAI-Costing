"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { Role } from "@prisma/client";

export async function inviteMemberAction(formData: FormData) {
  const ctx = await requireRole("ADMIN");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const role = String(formData.get("role") ?? "MEMBER") as Role;
  if (!email) return;
  if (!can.changeRoleTo(ctx.role, role)) throw new Error("Forbidden: cannot invite at that role.");

  const accountId = String(formData.get("accountId") ?? ctx.account.id).trim() || ctx.account.id;
  const targetAccount = await db.account.findFirst({ where: { id: accountId, organizationId: ctx.organization.id } });
  if (!targetAccount) throw new Error("Target account not found in this organization.");

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    await db.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: ctx.organization.id } },
        update: {},
        create: { userId: existingUser.id, organizationId: ctx.organization.id, role },
      });
      await tx.accountMembership.upsert({
        where: { userId_accountId: { userId: existingUser.id, accountId: targetAccount.id } },
        update: {},
        create: { userId: existingUser.id, accountId: targetAccount.id, role },
      });
    });
    await logAction({ organizationId: ctx.organization.id, accountId: targetAccount.id, userId: ctx.user.id, action: "member.add", detail: `Added existing user ${email} as ${role} to ${targetAccount.name}` });
  } else {
    await db.$executeRawUnsafe(
      `INSERT INTO "Invite" ("id","email","role","token","createdAt","organizationId","accountId") VALUES ($1,$2,$3::"Role",$4,NOW(),$5,$6)`,
      crypto.randomUUID(), email, role, crypto.randomUUID(), ctx.organization.id, targetAccount.id,
    );
    await logAction({ organizationId: ctx.organization.id, accountId: targetAccount.id, userId: ctx.user.id, action: "member.invite", detail: `Invited ${email} as ${role} to ${targetAccount.name}` });
  }
  revalidatePath("/admin");
  revalidatePath("/admin/members");
}

export async function updateMemberRoleAction(membershipId: string, newRole: Role) {
  const ctx = await requireRole("ADMIN");
  const membership = await db.membership.findFirst({ where: { id: membershipId, organizationId: ctx.organization.id } });
  if (!membership) throw new Error("Member not found.");
  if (!can.changeRoleTo(ctx.role, newRole) || !can.changeRoleTo(ctx.role, membership.role)) {
    throw new Error("Forbidden: only an owner can grant or change owner-level access.");
  }

  await db.membership.update({ where: { id: membershipId }, data: { role: newRole } });
  await logAction({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "member.role_change", detail: `Changed a member's role to ${newRole}` });
  revalidatePath("/admin");
}

export async function removeMemberAction(membershipId: string) {
  const ctx = await requireRole("ADMIN");
  const membership = await db.membership.findFirst({ where: { id: membershipId, organizationId: ctx.organization.id } });
  if (!membership) throw new Error("Member not found.");
  if (!can.removeMember(ctx.role, membership.role)) throw new Error("Forbidden.");

  await db.membership.delete({ where: { id: membershipId } });
  await logAction({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "member.remove", detail: "Removed a member from the organization" });
  revalidatePath("/admin");
}

export async function revokeInviteAction(inviteId: string) {
  const ctx = await requireRole("ADMIN");
  await db.invite.deleteMany({ where: { id: inviteId, organizationId: ctx.organization.id } });
  revalidatePath("/admin");
}

export async function updateOrganizationAction(formData: FormData) {
  const ctx = await requireRole("OWNER");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const rawSlug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const slug = rawSlug.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "") || ctx.organization.slug;
  const collision = await db.organization.findFirst({ where: { slug, id: { not: ctx.organization.id } } });
  if (collision) throw new Error("That organization slug is already in use.");
  await db.organization.update({ where: { id: ctx.organization.id }, data: { name, slug } });
  await logAction({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "organization.update", detail: `Updated organization identity to ${name}` });
  revalidatePath("/admin/organization");
  revalidatePath("/dashboard");
}
