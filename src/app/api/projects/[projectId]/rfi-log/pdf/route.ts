import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { renderRfiLogPdf } from "@/lib/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireOrgContext();

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: ctx.organization.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rfis = await db.rfi.findMany({ where: { projectId } });
  const buffer = await renderRfiLogPdf({
    orgName: ctx.organization.name,
    projectName: project.name,
    projectNumber: project.number,
    rfis,
    generatedAt: new Date(),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${project.name.replace(/\s+/g, "_")}_RFI_Log.pdf"`,
    },
  });
}
