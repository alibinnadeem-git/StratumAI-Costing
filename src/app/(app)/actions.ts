"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { ORG_COOKIE, getMemberships } from "@/lib/session";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function switchOrgAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgId = String(formData.get("organizationId") ?? "");
  const memberships = await getMemberships(session.user.id);
  if (!memberships.some((m) => m.organizationId === orgId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  redirect("/dashboard");
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

  const org = await db.$transaction(async (tx) => {
    const created = await tx.organization.create({ data: { name, slug } });
    await tx.membership.create({
      data: { userId: session.user.id!, organizationId: created.id, role: "OWNER" },
    });
    await tx.costSettings.create({ data: { organizationId: created.id } });
    return created;
  });

  await logAction({
    organizationId: org.id,
    userId: session.user.id,
    action: "organization.create",
    detail: `Created organization ${name}`,
  });

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, org.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  redirect("/dashboard");
}
