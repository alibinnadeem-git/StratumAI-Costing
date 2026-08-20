import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { renderRfqPdf } from "@/lib/rfq-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const ctx = await requireOrgContext();

  const rfq = await db.rfq.findFirst({
    where: { id: rfqId, project: { organizationId: ctx.organization.id } },
    include: { lineItems: true, project: true },
  });
  if (!rfq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderRfqPdf({
    orgName: ctx.organization.name,
    projectName: rfq.project.name,
    rfqNumber: rfq.number,
    title: rfq.title,
    dueDate: rfq.dueDate,
    notes: rfq.notes,
    lineItems: rfq.lineItems,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="RFQ-${String(rfq.number).padStart(3, "0")}_${rfq.title.replace(/\s+/g, "_")}.pdf"`,
    },
  });
}
