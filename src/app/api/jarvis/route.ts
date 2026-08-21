import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMemberships } from "@/lib/session";
import { localJarvisReply } from "@/lib/jarvis-guide";

export const dynamic = "force-dynamic";

type AccountRow = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  role: Role;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim().slice(0, 4000);
  const pathname = String(body?.pathname ?? "").slice(0, 512);

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const memberships = await getMemberships(session.user.id);
  const preferredOrgId = String(body?.organizationId ?? "");
  const membership = memberships.find((m) => m.organizationId === preferredOrgId) ?? memberships[0];

  if (!membership) {
    return NextResponse.json({ error: "No organization access" }, { status: 403 });
  }

  const requestedAccountId = String(body?.accountId ?? "");
  const accountRows = await db.$queryRaw<AccountRow[]>`
    SELECT
      a."id" AS "id",
      a."name" AS "name",
      a."slug" AS "slug",
      a."organizationId" AS "organizationId",
      am."role" AS "role"
    FROM "AccountMembership" am
    INNER JOIN "Account" a ON a."id" = am."accountId"
    WHERE am."userId" = ${session.user.id}
      AND a."organizationId" = ${membership.organizationId}
    ORDER BY a."createdAt" ASC, a."name" ASC
  `;

  const account = accountRows.find((row) => row.id === requestedAccountId) ?? accountRows[0];
  if (!account) {
    return NextResponse.json({ error: "No account/tenant access" }, { status: 403 });
  }

  const context = {
    pathname,
    organizationId: membership.organizationId,
    organization: membership.organization.name,
    accountId: account.id,
    account: account.name,
    organizationRole: membership.role,
    role: account.role,
  };

  const endpoint = process.env.JARVIS_ENDPOINT?.trim();
  const apiKey = process.env.JARVIS_API_KEY?.trim();

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          assistant: "Jarvis",
          message,
          context,
          policy: {
            tenantScoped: true,
            organizationScoped: true,
            accountScoped: true,
            readOnly: true,
            requireApprovalForWrites: true,
            neverBypassRbac: true,
          },
        }),
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        const answer = String(data?.answer ?? data?.message ?? "").trim();
        if (answer) {
          return NextResponse.json({ answer, mode: "ai", context: { accountId: account.id } });
        }
      }
    } catch {
      // Fall through to the built-in guidance layer so Jarvis remains useful
      // even when the external model provider is unavailable.
    }
  }

  return NextResponse.json({
    answer: localJarvisReply(message, context),
    mode: endpoint ? "fallback" : "guide",
    context: { accountId: account.id },
  });
}
