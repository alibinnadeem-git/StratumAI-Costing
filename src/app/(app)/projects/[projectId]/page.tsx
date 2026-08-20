import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import ProjectTabs from "./ProjectTabs";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireOrgContext();

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: ctx.organization.id },
  });
  if (!project) notFound();

  const [rfis, takeoffImports, rfqs, suppliers] = await Promise.all([
    db.rfi.findMany({ where: { projectId }, orderBy: { number: "desc" } }),
    db.takeoffImport.findMany({ where: { projectId }, include: { items: true }, orderBy: { importedAt: "desc" } }),
    db.rfq.findMany({ where: { projectId }, include: { lineItems: true, recipients: { include: { supplier: true } } }, orderBy: { number: "desc" } }),
    db.supplier.findMany({ where: { organizationId: ctx.organization.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <ProjectTabs
      project={{ id: project.id, name: project.name, number: project.number }}
      role={ctx.role}
      initialRfis={JSON.parse(JSON.stringify(rfis))}
      initialTakeoffImports={JSON.parse(JSON.stringify(takeoffImports))}
      initialRfqs={JSON.parse(JSON.stringify(rfqs))}
      suppliers={JSON.parse(JSON.stringify(suppliers))}
    />
  );
}
