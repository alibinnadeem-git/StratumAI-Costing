import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireOrgContext();

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: ctx.organization.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rfqs = await db.rfq.findMany({
    where: { projectId },
    include: { lineItems: true, recipients: { include: { supplier: true } } },
    orderBy: { number: "desc" },
  });
  return NextResponse.json(rfqs);
}
