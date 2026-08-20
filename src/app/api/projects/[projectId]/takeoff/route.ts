import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireOrgContext();

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: ctx.organization.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const imports = await db.takeoffImport.findMany({
    where: { projectId },
    include: { items: true },
    orderBy: { importedAt: "desc" },
  });
  return NextResponse.json(imports);
}
