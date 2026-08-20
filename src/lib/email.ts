import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendRfiLogEmail(params: {
  to: string[];
  projectName: string;
  orgName: string;
  pdfBuffer: Buffer;
  note?: string;
}) {
  const { to, projectName, orgName, pdfBuffer, note } = params;

  return resend.emails.send({
    from: process.env.EMAIL_FROM ?? "RFI Log <onboarding@resend.dev>",
    to,
    subject: `RFI Log — ${projectName}`,
    text:
      `${note ? note + "\n\n" : ""}` +
      `Attached is the current RFI log for ${projectName} (${orgName}), generated ${new Date().toLocaleDateString()}.`,
    attachments: [
      {
        filename: `${projectName.replace(/\s+/g, "_")}_RFI_Log.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

export async function sendRfqEmail(params: {
  to: string;
  supplierName: string;
  projectName: string;
  orgName: string;
  rfqNumber: number;
  title: string;
  dueDate: Date | null;
  pdfBuffer: Buffer;
}) {
  const { to, supplierName, projectName, orgName, rfqNumber, title, dueDate, pdfBuffer } = params;
  const due = dueDate ? new Date(dueDate).toLocaleDateString() : "as soon as possible";

  return resend.emails.send({
    from: process.env.EMAIL_FROM ?? "RFQ <onboarding@resend.dev>",
    to: [to],
    subject: `RFQ-${String(rfqNumber).padStart(3, "0")} — ${title} (${projectName})`,
    text:
      `Hi ${supplierName},\n\n` +
      `${orgName} is requesting a quote for ${title} on ${projectName}. Line items and quantities are in the attached PDF. ` +
      `Please return pricing by ${due}.\n\nThanks,\n${orgName}`,
    attachments: [
      {
        filename: `RFQ-${String(rfqNumber).padStart(3, "0")}_${title.replace(/\s+/g, "_")}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}
