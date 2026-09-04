"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { ACCOUNT_COOKIE, ORG_COOKIE } from "@/lib/session";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function acceptPendingInviteAction(inviteId: string) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");
  const email = session.user.email.toLowerCase().trim();

  const invite = await db.invite.findFirst({
    where: { id: inviteId, email, acceptedAt: null },
    include: { organization: true, account: true },
  });
  if (!invite) throw new Error("Invite not found for this signed-in email or it was already accepted.");

  const account = invite.account ?? await db.account.findFirst({ where: { organizationId: invite.organizationId, slug: "main" } });
  if (!account || account.organizationId !== invite.organizationId) {
    throw new Error("Invite does not have a valid account/tenant target.");
  }

  await db.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { userId_organizationId: { userId: session.user.id!, organizationId: invite.organizationId } },
      update: {},
      create: { userId: session.user.id!, organizationId: invite.organizationId, role: invite.role },
    });
    await tx.accountMembership.upsert({
      where: { userId_accountId: { userId: session.user.id!, accountId: account.id } },
      update: {},
      create: { userId: session.user.id!, accountId: account.id, role: invite.role },
    });
    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date(), accountId: account.id } });
  });

  await logAction({
    organizationId: invite.organizationId,
    accountId: account.id,
    userId: session.user.id,
    action: "member.invite_accept",
    detail: `Accepted invite to ${invite.organization.name} · ${account.name} as ${invite.role}`,
  });

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, invite.organizationId, cookieOptions);
  cookieStore.set(ACCOUNT_COOKIE, account.id, cookieOptions);
  redirect("/dashboard");
}
