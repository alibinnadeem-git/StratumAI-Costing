import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { renderRfqPdf } from "@/lib/rfq-pdf";
import { sendRfqEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

// Sends the RFQ to every PENDING/FAILED recipient — one email per supplier,
// each with its own PDF (so the "Supplier" field on the cover matches the
// person receiving it). Per-recipient failures don't block the others.
export async function POST(_req: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const ctx = await requireOrgContext();
  if (!can.sendRfq(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rfq = await db.rfq.findFirst({
    where: { id: rfqId, project: { organizationId: ctx.organization.id } },
    include: { lineItems: true, project: true, recipients: { include: { supplier: true } } },
  });
  if (!rfq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toSend = rfq.recipients.filter((r) => r.status !== "SENT");
  if (toSend.length === 0) return NextResponse.json({ error: "Already sent to every supplier on this RFQ." }, { status: 400 });

  const results = await Promise.allSettled(
    toSend.map(async (recipient) => {
      const pdfBuffer = await renderRfqPdf({
        orgName: ctx.organization.name,
        projectName: rfq.project.name,
        rfqNumber: rfq.number,
        title: rfq.title,
        dueDate: rfq.dueDate,
        notes: rfq.notes,
        supplierName: recipient.supplier.name,
        lineItems: rfq.lineItems,
      });

      await sendRfqEmail({
        to: recipient.supplier.email,
        supplierName: recipient.supplier.contactName || recipient.supplier.name,
        projectName: rfq.project.name,
        orgName: ctx.organization.name,
        rfqNumber: rfq.number,
        title: rfq.title,
        dueDate: rfq.dueDate,
        pdfBuffer,
      });

      await db.rfqRecipient.update({ where: { id: recipient.id }, data: { status: "SENT", sentAt: new Date() } });
      return recipient.supplier.name;
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<string>).value);
  const failedRecipients = toSend.filter((_, i) => results[i]?.status === "rejected");
  if (failedRecipients.length > 0) {
    await db.rfqRecipient.updateMany({ where: { id: { in: failedRecipients.map((r) => r.id) } }, data: { status: "FAILED" } });
  }

  await db.rfq.update({ where: { id: rfqId }, data: { status: "SENT" } });
  await logAction({
    organizationId: ctx.organization.id, userId: ctx.user.id, projectId: rfq.projectId,
    action: "rfq.send", detail: `Sent RFQ-${String(rfq.number).padStart(3, "0")} to ${sent.join(", ") || "no one (all failed)"}`,
  });

  return NextResponse.json({ sent: sent.length, failed: failedRecipients.length });
}
