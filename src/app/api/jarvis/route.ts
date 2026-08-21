import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemberships } from "@/lib/session";
import { localJarvisReply } from "@/lib/jarvis-guide";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim().slice(0, 4000);
  const pathname = String(body?.pathname ?? "").slice(0, 512);
  const account = body?.account ? String(body.account).slice(0, 256) : undefined;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const memberships = await getMemberships(session.user.id);
  const preferredOrgId = String(body?.organizationId ?? "");
  const membership = memberships.find((m) => m.organizationId === preferredOrgId) ?? memberships[0];

  if (!membership) {
    return NextResponse.json({ error: "No organization access" }, { status: 403 });
  }

  const context = {
    pathname,
    organization: membership.organization.name,
    account,
    role: membership.role,
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
          return NextResponse.json({ answer, mode: "ai" });
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
  });
}
