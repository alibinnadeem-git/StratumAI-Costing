import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { getSpatialAnnotations } from "@/lib/spatial-context";
import MarkupCanvas from "./MarkupCanvas";

type Revision={id:string;sheetNumber:string;sheetTitle:string|null;revision:string;externalUrl:string|null;sourcePageNumber:number|null};

export default async function DrawingMarkupPage({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{revisionId?:string}>}){
  const {projectId}=await params;const sp=await searchParams;const ctx=await requireTenantContext();const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)notFound();
  const [revisions,annotations]=await Promise.all([
    db.$queryRawUnsafe<Revision[]>(`SELECT r."id",r."sheetNumber",r."sheetTitle",r."revision",r."externalUrl",r."sourcePageNumber" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE s."projectId"=$1 AND r."accountId"=$2 ORDER BY r."createdAt" DESC`,projectId,ctx.account.id),
    getSpatialAnnotations(projectId,ctx.account.id),
  ]);
  return <div className="space-y-5"><section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Drawing Intelligence · Markup</p><h1 className="stratum-sheet-title">{project.name} Drawing Annotations</h1><p className="mt-2 max-w-4xl text-sm text-[#9CB2C2]">Place persistent issue, question, clash, safety, quality, change, commercial or note pins directly against a drawing revision. Positions are stored as normalized page coordinates in Neon so pins survive responsive resizing.</p></div><div className="flex flex-wrap gap-2"><Link href={`/projects/${projectId}/annotations`} className="btn">Annotation Register</Link><Link href={`/projects/${projectId}/reality-capture`} className="btn-secondary">Matterport</Link><Link href={`/projects/${projectId}/drawings/viewer`} className="btn-secondary">Spatial Viewer</Link><Link href={`/projects/${projectId}/drawings`} className="btn-secondary">Drawings</Link></div></div></section><MarkupCanvas projectId={projectId} revisions={JSON.parse(JSON.stringify(revisions))} annotations={JSON.parse(JSON.stringify(annotations))} initialRevisionId={sp.revisionId}/><section className="stratum-sheet"><h2 className="text-sm font-semibold text-[#DCEBF5]">Rendering boundary</h2><p className="mt-2 text-xs text-[#9CB2C2]">The current markup surface overlays the registered source document in-browser and stores normalized annotation coordinates. The next PDF-native increment will rasterize/render the exact source page into the viewer so rotation, crop boxes, and zoom transforms are controlled by STRATUM Electric rather than the browser PDF viewer.</p></section></div>;
}
