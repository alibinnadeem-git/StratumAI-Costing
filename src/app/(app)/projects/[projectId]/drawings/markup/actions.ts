"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

export async function saveDrawingViewAction(projectId:string,revisionId:string,input:{rotationDegrees:number;cropJson?:unknown|null}){
  const ctx=await requireAccountRole("MEMBER");
  const rows=await db.$queryRawUnsafe<Array<{id:string;rotationDegrees:number}>>(`SELECT r."id",r."rotationDegrees" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,revisionId,ctx.account.id,projectId);
  const revision=rows[0];
  if(!revision)throw new Error("Drawing revision not found in this project.");
  const rotation=[0,90,180,270].includes(input.rotationDegrees)?input.rotationDegrees:0;

  if(rotation!==revision.rotationDegrees){
    const dependencies=await db.$queryRawUnsafe<Array<{annotationCount:bigint;takeoffCount:bigint;contextLinkCount:bigint}>>(`SELECT
      (SELECT COUNT(*) FROM "SpatialAnnotation" WHERE "drawingRevisionId"=$1 AND "accountId"=$2) AS "annotationCount",
      (SELECT COUNT(*) FROM "SpatialTakeoffObject" WHERE "drawingRevisionId"=$1 AND "accountId"=$2) AS "takeoffCount",
      (SELECT COUNT(*) FROM "SpatialContextLink" WHERE "drawingRevisionId"=$1 AND "accountId"=$2) AS "contextLinkCount"`,revisionId,ctx.account.id);
    const dep=dependencies[0];
    const annotationCount=Number(dep?.annotationCount??0);
    const takeoffCount=Number(dep?.takeoffCount??0);
    const contextLinkCount=Number(dep?.contextLinkCount??0);
    if(annotationCount||takeoffCount||contextLinkCount){
      throw new Error(`Canonical rotation cannot change after spatial geometry exists (${annotationCount} annotation(s), ${takeoffCount} takeoff object(s), ${contextLinkCount} reality link(s)). Create a new controlled drawing revision instead.`);
    }
  }

  await db.$executeRawUnsafe(`UPDATE "DrawingRevision" SET "rotationDegrees"=$1,"cropJson"=$2::jsonb,"viewUpdatedAt"=CURRENT_TIMESTAMP WHERE "id"=$3 AND "accountId"=$4`,rotation,JSON.stringify(input.cropJson??null),revisionId,ctx.account.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.view.update",detail:`Updated canonical drawing view for revision ${revisionId}: rotation ${revision.rotationDegrees}° → ${rotation}°`});
  revalidatePath(`/projects/${projectId}/drawings/markup`);
  revalidatePath(`/projects/${projectId}/drawings/viewer`);
  revalidatePath(`/projects/${projectId}/drawings/revision-delta`);
}