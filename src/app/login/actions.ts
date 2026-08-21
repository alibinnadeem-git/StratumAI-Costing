"use server";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

function safeNext(value: unknown) {
  const path = String(value ?? "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  let authenticated = false;
  try {
    authenticated = await signIn("credentials", { email, password });
  } catch (error) {
    console.error("Login failed", error);
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }

  if (!authenticated) return { error: "Invalid email or password." };
  redirect(next);
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

  try {
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
      await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role: "OWNER" } });
      await tx.costSettings.create({ data: { organizationId: org.id } });
    });

    const authenticated = await signIn("credentials", { email, password });
    if (!authenticated) {
      return { error: "Your organization was created, but automatic sign-in failed. Please sign in." };
    }
  } catch (error) {
    console.error("Organization registration failed", error);
    return { error: "We could not create the organization right now. Please try again." };
  }

  redirect("/dashboard");
}
