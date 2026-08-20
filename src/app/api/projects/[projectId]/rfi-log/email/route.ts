import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { renderRfiLogPdf } from "@/lib/pdf";
import { sendRfiLogEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";
import { z } from "zod";

const bodySchema = z.object({
  emails: z.array(z.string().email()).min(1, "Add at least one valid recipient."),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireOrgContext();

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: ctx.organization.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const rfis = await db.rfi.findMany({ where: { projectId } });
  const pdfBuffer = await renderRfiLogPdf({
    orgName: ctx.organization.name,
    projectName: project.name,
    projectNumber: project.number,
    rfis,
    generatedAt: new Date(),
  });

  try {
    await sendRfiLogEmail({
      to: parsed.data.emails,
      projectName: project.name,
      orgName: ctx.organization.name,
      pdfBuffer,
      note: parsed.data.note,
    });
  } catch {
    return NextResponse.json({ error: "Email provider rejected the send. Check RESEND_API_KEY / EMAIL_FROM." }, { status: 502 });
  }

  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId,
    action: "rfi_log.email", detail: `Emailed RFI log to ${parsed.data.emails.join(", ")}`,
  });

  return NextResponse.json({ ok: true });
}
