import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/session";
import { db } from "@/lib/db";
import ProjectTabs from "./ProjectTabs";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireTenantContext();

  const project = await db.project.findFirst({
    where: { id: projectId, accountId: ctx.account.id },
  });
  if (!project) notFound();

  const [rfis, takeoffImports, rfqs, suppliers] = await Promise.all([
    db.rfi.findMany({ where: { projectId, project: { accountId: ctx.account.id } }, orderBy: { number: "desc" } }),
    db.takeoffImport.findMany({ where: { projectId, project: { accountId: ctx.account.id } }, include: { items: true }, orderBy: { importedAt: "desc" } }),
    db.rfq.findMany({ where: { projectId, project: { accountId: ctx.account.id } }, include: { lineItems: true, recipients: { include: { supplier: true } } }, orderBy: { number: "desc" } }),
    db.supplier.findMany({ where: { accountId: ctx.account.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <ProjectTabs
      project={{ id: project.id, name: project.name, number: project.number }}
      role={ctx.accountRole}
      initialRfis={JSON.parse(JSON.stringify(rfis))}
      initialTakeoffImports={JSON.parse(JSON.stringify(takeoffImports))}
      initialRfqs={JSON.parse(JSON.stringify(rfqs))}
      suppliers={JSON.parse(JSON.stringify(suppliers))}
    />
  );
}
