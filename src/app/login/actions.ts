"use server";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

type ActionState = { error?: string };

function safeNext(value: unknown) {
  const path = String(value ?? "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

function authFailureMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (code === "P1000" || code === "P1001" || code === "P1002") {
    return "Database connection is unavailable. Please try again shortly. [DB-CONNECT]";
  }
  if (code === "P2021" || code === "P2022") {
    return "Authentication database schema is not synchronized. [DB-SCHEMA]";
  }

  return "Sign-in is temporarily unavailable. Please try again. [AUTH-RUNTIME]";
}

export async function loginAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  let authenticated: boolean;
  try {
    authenticated = await signIn("credentials", { email, password });
  } catch (error) {
    console.error("Login failed", error);
    return { error: authFailureMessage(error) };
  }

  if (!authenticated) return { error: "Invalid email or password." };

  redirect(next);
}

export async function registerOrgAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const orgName = String(formData.get("orgName") ?? "").trim();

  if (!name || !email || !password || !orgName) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  try {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) return { error: "An account with that email already exists." };

    const passwordHash = await bcrypt.hash(password, 10);
    const baseSlug =
      orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
      `org-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 2;
    while (await db.organization.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      const org = await tx.organization.create({ data: { name: orgName, slug } });
      await tx.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "OWNER" },
      });
      await tx.costSettings.create({ data: { organizationId: org.id } });
    });

    const authenticated = await signIn("credentials", { email, password });
    if (!authenticated) {
      return { error: "Organization created. Please sign in with the account you just created." };
    }
  } catch (error) {
    console.error("Organization registration failed", error);
    return { error: authFailureMessage(error) };
  }

  redirect("/dashboard");
}
