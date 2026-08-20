"use server";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { bootstrapOrganization } from "@/lib/tenant-bootstrap";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  try {
    await signIn("credentials", { email, password, redirectTo: next || "/dashboard" });
    return {};
  } catch (err) {
    if (err instanceof AuthError) return { error: "Invalid email or password." };
    // NEXT_REDIRECT throws are how next-auth performs the redirect — rethrow those.
    throw err;
  }
}

export async function registerOrgAction(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const orgName = String(formData.get("orgName") ?? "").trim();

  if (!name || !email || !password || !orgName) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);
  const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `org-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;
  while (await db.organization.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    const org = await tx.organization.create({ data: { name: orgName, slug } });
    // First user in a new org is always the OWNER.
    await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role: "OWNER" } });
    await bootstrapOrganization(tx, org.id);
  });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return {};
}
