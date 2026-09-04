import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { getSpatialAnnotations } from "@/lib/spatial-context";
import MarkupCanvas from "./MarkupCanvas";

type Revision={id:string;sheetNumber:string;sheetTitle:string|null;revision:string;externalUrl:string|null;sourcePageNumber:number|null;rotationDegrees:number;cropJson:unknown};
export default async function DrawingMarkupPage({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{revisionId?:string}>}){
  const {projectId}=await params;const sp=await searchParams;const ctx=await requireTenantContext();const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)notFound();
  const [revisions,annotations]=await Promise.all([db.$queryRawUnsafe<Revision[]>(`SELECT r."id",r."sheetNumber",r."sheetTitle",r."revision",COALESCE(pr."externalUrl",r."externalUrl",d."externalUrl") AS "externalUrl",r."sourcePageNumber",r."rotationDegrees",r."cropJson" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" LEFT JOIN "ProjectDocument" d ON d."id"=r."sourceDocumentId" LEFT JOIN "ProjectDocumentRevision" pr ON pr."id"=r."sourceDocumentRevisionId" WHERE s."projectId"=$1 AND r."accountId"=$2 ORDER BY r."createdAt" DESC`,projectId,ctx.account.id),getSpatialAnnotations(projectId,ctx.account.id)]);
  return <div className="space-y-5"><section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Drawing Intelligence · PDF Markup</p><h1 className="stratum-sheet-title">{project.name} Drawing Annotations</h1><p className="mt-2 max-w-4xl text-sm text-[#9CB2C2]">Render the exact Plan Room PDF page with PDF.js, then place persistent normalized annotations over the controlled page surface. Canonical rotation and crop metadata now travel with the drawing revision.</p></div><div className="flex flex-wrap gap-2"><Link href={`/projects/${projectId}/annotations`} className="btn">Annotation Register</Link><Link href={`/projects/${projectId}/reality-capture`} className="btn-secondary">Matterport</Link><Link href={`/projects/${projectId}/drawings/viewer`} className="btn-secondary">Spatial Viewer</Link></div></div></section><MarkupCanvas projectId={projectId} revisions={JSON.parse(JSON.stringify(revisions))} annotations={JSON.parse(JSON.stringify(annotations))} initialRevisionId={sp.revisionId}/></div>;
}
