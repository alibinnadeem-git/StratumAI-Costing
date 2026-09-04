import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { getDrawingWorkspace } from "@/lib/drawing-native";
import SpatialViewer from "./SpatialViewer";

export default async function ViewerPage({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params; const ctx=await requireTenantContext(); const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}}); if(!project) notFound();
  const {revisions,layers,objects}=await getDrawingWorkspace(projectId,ctx.account.id);
  const costLinks=await db.$queryRawUnsafe<Array<{spatialObjectId:string;estimateLineId:string;estimateId:string;description:string;estimateNumber:number;quantityBasis:number|null}>>(`SELECT l."spatialObjectId",l."estimateLineId",e."id" AS "estimateId",i."description",e."number" AS "estimateNumber",l."quantityBasis" FROM "SpatialEstimateLink" l JOIN "EstimateLineItem" i ON i."id"=l."estimateLineId" JOIN "CostEstimate" e ON e."id"=i."estimateId" WHERE l."accountId"=$1 AND e."projectId"=$2`,ctx.account.id,projectId);
  return <div className="space-y-5"><section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Spatial Viewer</p><h1 className="stratum-sheet-title">{project.name} Drawing Intelligence</h1><p className="mt-2 max-w-4xl text-sm text-[#9CB2C2]">Draw Count / Linear / Area takeoff directly on the sheet, move existing objects, compare revisions, and preserve calibrated commercial provenance in Neon.</p></div><div className="flex flex-wrap gap-2"><Link href={`/projects/${projectId}/drawings/review`} className="btn-secondary">Review Queue</Link><Link href={`/projects/${projectId}/drawings/calibration`} className="btn-secondary">Calibration</Link><Link href={`/projects/${projectId}/drawings/revision-delta`} className="btn-secondary">Revision Delta</Link><Link href={`/projects/${projectId}/drawings`} className="btn-secondary">Workspace</Link></div></div></section><SpatialViewer projectId={projectId} revisions={JSON.parse(JSON.stringify(revisions))} layers={JSON.parse(JSON.stringify(layers))} objects={JSON.parse(JSON.stringify(objects))} costLinks={JSON.parse(JSON.stringify(costLinks))}/></div>;
}
