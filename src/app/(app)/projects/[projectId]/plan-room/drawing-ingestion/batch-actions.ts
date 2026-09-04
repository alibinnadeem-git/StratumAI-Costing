"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

const s=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const num=(fd:FormData,k:string)=>{const v=Number(fd.get(k));return Number.isFinite(v)?Math.trunc(v):0;};

function inferSheet(name:string,page:number){
  const base=name.replace(/\.[^.]+$/g,"");
  const match=base.match(/\b([A-Z]{1,4}[\s_-]?\d{2,4}(?:\.\d+)?)\b/i);
  const sheet=match?.[1]?.replace(/[\s_]+/g,"-").toUpperCase()??null;
  const title=base.replace(/[_]+/g," ").replace(/\s+/g," ").trim();
  return {sheet,title:sheet?title.replace(new RegExp(sheet.replace("-","[\\s_-]?"),"i"),"").replace(/^\s*[-–—:]\s*/,"").trim()||null:title||null,confidence:sheet?.length?0.72:0.35,page};
}
function disciplineFor(type:string){const t=type.toUpperCase();return ["ELECTRICAL","ARCHITECTURAL","MECHANICAL","PLUMBING","CIVIL","STRUCTURAL"].includes(t)?t:"GENERAL";}
async function ctxFor(projectId:string){const ctx=await requireAccountRole("MEMBER");const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)throw new Error("Project not found in this account.");return ctx;}

export async function queueDrawingPageRangeAction(projectId:string,formData:FormData){
  const ctx=await ctxFor(projectId); const documentId=s(formData,"documentId"); const documentRevisionId=s(formData,"documentRevisionId")||null; const start=Math.max(1,num(formData,"startPage")||1); const end=Math.max(start,num(formData,"endPage")||start);
  if(!documentId)throw new Error("Plan Room document is required."); if(end-start>199)throw new Error("Queue at most 200 pages at a time.");
  const docs=await db.$queryRawUnsafe<Array<{id:string;name:string;documentType:string}>>(`SELECT "id","name","documentType" FROM "ProjectDocument" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,documentId,projectId,ctx.account.id); const doc=docs[0]; if(!doc)throw new Error("Document not found in this Plan Room.");
  let revision:string|null=null;
  if(documentRevisionId){const rows=await db.$queryRawUnsafe<Array<{revision:string}>>(`SELECT "revision" FROM "ProjectDocumentRevision" WHERE "id"=$1 AND "documentId"=$2 AND "accountId"=$3`,documentRevisionId,documentId,ctx.account.id);if(!rows[0])throw new Error("Document revision not found.");revision=rows[0].revision;}
  const discipline=disciplineFor(doc.documentType); let queued=0,skipped=0;
  for(let page=start;page<=end;page++){
    const exists=documentRevisionId?await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "PlanRoomDrawingIngestion" WHERE "documentRevisionId"=$1 AND "pageNumber"=$2`,documentRevisionId,page):await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "PlanRoomDrawingIngestion" WHERE "documentId"=$1 AND "documentRevisionId" IS NULL AND "pageNumber"=$2`,documentId,page);
    if(exists[0]){skipped++;continue;}
    const detected=inferSheet(doc.name,page);
    await db.$executeRawUnsafe(`INSERT INTO "PlanRoomDrawingIngestion" ("id","projectId","accountId","documentId","documentRevisionId","status","discipline","detectedSheetNumber","detectedSheetTitle","detectedRevision","pageNumber","confidence","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,'REVIEW',$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)`,randomUUID(),projectId,ctx.account.id,documentId,documentRevisionId,discipline,detected.sheet,detected.title,revision||"0",page,detected.confidence,ctx.user.id);queued++;
  }
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"plan_room.drawing_ingestion.batch_queue",detail:`Queued ${queued} drawing intake page(s) from ${doc.name}, pages ${start}-${end}; ${skipped} already queued`});
  revalidatePath(`/projects/${projectId}/plan-room/drawing-ingestion`);
}

export async function rejectDrawingIngestionAction(projectId:string,formData:FormData){
  const ctx=await ctxFor(projectId); const ingestionId=s(formData,"ingestionId"); const reason=s(formData,"reason")||"Rejected during drawing intake review."; if(!ingestionId)throw new Error("Ingestion item is required.");
  const rows=await db.$queryRawUnsafe<Array<{id:string;status:string;documentId:string;pageNumber:number|null}>>(`SELECT "id","status","documentId","pageNumber" FROM "PlanRoomDrawingIngestion" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,ingestionId,projectId,ctx.account.id);const item=rows[0];if(!item)throw new Error("Ingestion item not found.");if(item.status==="INGESTED")throw new Error("An ingested drawing cannot be rejected; supersede it through drawing revision control.");
  await db.$executeRawUnsafe(`UPDATE "PlanRoomDrawingIngestion" SET "status"='REJECTED',"errorMessage"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "accountId"=$3`,reason,item.id,ctx.account.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"plan_room.drawing_ingestion.reject",detail:`Rejected drawing intake ${item.id} page ${item.pageNumber??1}: ${reason}`});
  revalidatePath(`/projects/${projectId}/plan-room/drawing-ingestion`);
}

export async function restoreDrawingIngestionAction(projectId:string,formData:FormData){
  const ctx=await ctxFor(projectId); const ingestionId=s(formData,"ingestionId"); if(!ingestionId)throw new Error("Ingestion item is required.");
  const changed=await db.$executeRawUnsafe(`UPDATE "PlanRoomDrawingIngestion" SET "status"='REVIEW',"errorMessage"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3 AND "status" IN ('REJECTED','FAILED')`,ingestionId,projectId,ctx.account.id); if(!changed)throw new Error("Only rejected or failed intake items can be restored.");
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"plan_room.drawing_ingestion.restore",detail:`Restored drawing intake ${ingestionId} to review`}); revalidatePath(`/projects/${projectId}/plan-room/drawing-ingestion`);
}
