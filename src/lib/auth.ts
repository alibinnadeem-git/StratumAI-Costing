import "server-only";

import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "stratum_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionShape = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

function sessionSignature(userId: string, issuedAt: string, passwordHash: string) {
  return createHmac("sha256", passwordHash)
    .update(`${userId}.${issuedAt}`)
    .digest("base64url");
}

function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sanitizeRedirect(value: unknown) {
  const path = String(value ?? "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function auth(): Promise<SessionShape | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const [userId, issuedAt, signature] = raw.split(".");
  if (!userId || !issuedAt || !signature) return null;

  const issuedAtSeconds = Number(issuedAt);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(issuedAtSeconds)) return null;
  if (issuedAtSeconds > nowSeconds + 300) return null;
  if (nowSeconds - issuedAtSeconds > SESSION_TTL_SECONDS) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user) return null;

  const expected = sessionSignature(user.id, issuedAt, user.passwordHash);
  if (!constantTimeEqual(signature, expected)) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email,
    },
  };
}

export async function signIn(
  _provider: "credentials",
  options: { email?: unknown; password?: unknown; redirectTo?: unknown }
) {
  const email = String(options.email ?? "").toLowerCase().trim();
  const password = String(options.password ?? "");
  if (!email || !password) return false;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return false;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return false;

  const issuedAt = String(Math.floor(Date.now() / 1000));
  const signature = sessionSignature(user.id, issuedAt, user.passwordHash);
  const value = `${user.id}.${issuedAt}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect(sanitizeRedirect(options.redirectTo));
}

export async function signOut(options?: { redirectTo?: unknown }) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect(sanitizeRedirect(options?.redirectTo ?? "/login"));
}
