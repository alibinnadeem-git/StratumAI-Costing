"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

type TitleBlockRegion={type:"TITLE_BLOCK_REGION";x1:number;y1:number;x2:number;y2:number};
const finite01=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1;
function validateCropJson(raw:unknown):TitleBlockRegion|null{
  if(raw==null)return null;
  if(typeof raw!=="object"||Array.isArray(raw))throw new Error("Drawing crop metadata is invalid.");
  const x=raw as Record<string,unknown>;
  if(x.type!=="TITLE_BLOCK_REGION")throw new Error("Unsupported drawing crop metadata type.");
  if(!finite01(x.x1)||!finite01(x.y1)||!finite01(x.x2)||!finite01(x.y2))throw new Error("Title-block region coordinates must be normalized between 0 and 1.");
  if(Math.abs(x.x2-x.x1)<0.02||Math.abs(x.y2-x.y1)<0.02)throw new Error("Title-block region is too small.");
  return{type:"TITLE_BLOCK_REGION",x1:Math.min(x.x1,x.x2),y1:Math.min(x.y1,x.y2),x2:Math.max(x.x1,x.x2),y2:Math.max(x.y1,x.y2)};
}
function refreshDrawingPaths(projectId:string){
  revalidatePath(`/projects/${projectId}/drawings/markup`);
  revalidatePath(`/projects/${projectId}/drawings/viewer`);
  revalidatePath(`/projects/${projectId}/drawings/revision-delta`);
  revalidatePath(`/projects/${projectId}/drawings/review`);
}

export async function saveDrawingViewAction(projectId:string,revisionId:string,input:{rotationDegrees:number;cropJson?:unknown|null}){
  const ctx=await requireAccountRole("MEMBER");
  const rows=await db.$queryRawUnsafe<Array<{id:string;rotationDegrees:number;cropJson:unknown}>>(`SELECT r."id",r."rotationDegrees",r."cropJson" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,revisionId,ctx.account.id,projectId);
  const revision=rows[0];
  if(!revision)throw new Error("Drawing revision not found in this project.");
  const rotation=[0,90,180,270].includes(input.rotationDegrees)?input.rotationDegrees:0;
  const cropJson=validateCropJson(input.cropJson??null);

  if(rotation!==revision.rotationDegrees){
    const dependencies=await db.$queryRawUnsafe<Array<{annotationCount:bigint;takeoffCount:bigint;contextLinkCount:bigint}>>(`SELECT
      (SELECT COUNT(*) FROM "SpatialAnnotation" WHERE "drawingRevisionId"=$1 AND "accountId"=$2) AS "annotationCount",
      (SELECT COUNT(*) FROM "SpatialTakeoffObject" WHERE "drawingRevisionId"=$1 AND "accountId"=$2) AS "takeoffCount",
      (SELECT COUNT(*) FROM "SpatialContextLink" WHERE "drawingRevisionId"=$1 AND "accountId"=$2) AS "contextLinkCount"`,revisionId,ctx.account.id);
    const dep=dependencies[0];
    const annotationCount=Number(dep?.annotationCount??0);const takeoffCount=Number(dep?.takeoffCount??0);const contextLinkCount=Number(dep?.contextLinkCount??0);
    if(annotationCount||takeoffCount||contextLinkCount)throw new Error(`Canonical rotation cannot change after spatial geometry exists (${annotationCount} annotation(s), ${takeoffCount} takeoff object(s), ${contextLinkCount} reality link(s)). Create a new controlled drawing revision instead.`);
  }

  await db.$executeRawUnsafe(`UPDATE "DrawingRevision" SET "rotationDegrees"=$1,"cropJson"=$2::jsonb,"viewUpdatedAt"=CURRENT_TIMESTAMP WHERE "id"=$3 AND "accountId"=$4`,rotation,JSON.stringify(cropJson),revisionId,ctx.account.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.view.update",detail:`Updated canonical drawing view for revision ${revisionId}: rotation ${revision.rotationDegrees}° → ${rotation}°${cropJson?` · title-block region ${cropJson.x1.toFixed(2)},${cropJson.y1.toFixed(2)}-${cropJson.x2.toFixed(2)},${cropJson.y2.toFixed(2)}`:""}`});
  refreshDrawingPaths(projectId);
}

export async function saveExtractedDrawingMetadataAction(projectId:string,revisionId:string,input:{sheetNumber:string;sheetTitle:string;revision:string;extracted?:unknown}){
  const ctx=await requireAccountRole("MEMBER");
  const rows=await db.$queryRawUnsafe<Array<{id:string;sheetNumber:string;sheetTitle:string|null;revision:string}>>(`SELECT r."id",r."sheetNumber",r."sheetTitle",r."revision" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,revisionId,ctx.account.id,projectId);
  const current=rows[0];if(!current)throw new Error("Drawing revision not found in this project.");
  const sheetNumber=input.sheetNumber.trim().slice(0,80);const sheetTitle=input.sheetTitle.trim().slice(0,240);const revision=input.revision.trim().slice(0,40);
  if(!sheetNumber)throw new Error("Sheet number is required.");if(!revision)throw new Error("Revision label is required.");
  let extractedJson:string|null=null;
  if(input.extracted!==undefined){const serialized=JSON.stringify(input.extracted);if(serialized.length>50000)throw new Error("Extracted metadata provenance is too large.");extractedJson=serialized;}
  await db.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`INSERT INTO "DrawingMetadataRevision" ("id","drawingRevisionId","projectId","accountId","previousSheetNumber","previousSheetTitle","previousRevision","newSheetNumber","newSheetTitle","newRevision","source","extractedJson","createdById") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,NULLIF($8,''),$9,'PDF_TEXT_REVIEW',$10::jsonb,$11)`,revisionId,projectId,ctx.account.id,current.sheetNumber,current.sheetTitle,current.revision,sheetNumber,sheetTitle,revision,extractedJson,ctx.user.id);
    await tx.$executeRawUnsafe(`UPDATE "DrawingRevision" SET "sheetNumber"=$1,"sheetTitle"=NULLIF($2,''),"revision"=$3,"viewUpdatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4 AND "accountId"=$5`,sheetNumber,sheetTitle,revision,revisionId,ctx.account.id);
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.metadata.review",detail:`Reviewed PDF metadata for drawing revision ${revisionId}: ${current.sheetNumber} R${current.revision} → ${sheetNumber} R${revision}${sheetTitle?` · ${sheetTitle}`:""}`});
  refreshDrawingPaths(projectId);
}
