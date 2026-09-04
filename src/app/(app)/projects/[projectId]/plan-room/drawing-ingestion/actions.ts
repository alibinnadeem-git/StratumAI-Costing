"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

const s=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const n=(fd:FormData,k:string)=>{const v=Number(fd.get(k));return Number.isFinite(v)?v:0;};

function inferSheetNumber(name:string){
  const base=name.replace(/\.[^.]+$/g,"");
  const match=base.match(/\b([A-Z]{1,4}[\s_-]?\d{2,4}(?:\.\d+)?)\b/i);
  return match?.[1]?.replace(/[\s_]+/g,"-").toUpperCase()??null;
}
function inferTitle(name:string,sheet:string|null){
  let base=name.replace(/\.[^.]+$/g,"").replace(/[_]+/g," ").replace(/\s+/g," ").trim();
  if(sheet)base=base.replace(new RegExp(sheet.replace("-","[\\s_-]?"),"i"),"").replace(/^\s*[-–—:]\s*/,"").trim();
  return base||null;
}
function disciplineFor(documentType:string){
  const t=documentType.toUpperCase();
  return ["ELECTRICAL","ARCHITECTURAL","MECHANICAL","PLUMBING","CIVIL","STRUCTURAL"].includes(t)?t:"GENERAL";
}
async function projectCtx(projectId:string){
  const ctx=await requireAccountRole("MEMBER");
  const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});
  if(!project)throw new Error("Project not found in this account.");
  return {ctx,project};
}

type DocRow={id:string;name:string;documentType:string;externalUrl:string|null};
type RevRow={id:string;documentId:string;revision:string;externalUrl:string|null;issuedAt:Date|null};

export async function queueDrawingIngestionAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId);
  const documentId=s(formData,"documentId"); const documentRevisionId=s(formData,"documentRevisionId")||null; const pageNumber=Math.max(1,n(formData,"pageNumber")||1);
  if(!documentId)throw new Error("Plan Room document is required.");
  const docs=await db.$queryRawUnsafe<DocRow[]>(`SELECT "id","name","documentType","externalUrl" FROM "ProjectDocument" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,documentId,projectId,ctx.account.id); const doc=docs[0]; if(!doc)throw new Error("Document not found in this Plan Room.");
  let revision:RevRow|null=null;
  if(documentRevisionId){const rows=await db.$queryRawUnsafe<RevRow[]>(`SELECT "id","documentId","revision","externalUrl","issuedAt" FROM "ProjectDocumentRevision" WHERE "id"=$1 AND "documentId"=$2 AND "accountId"=$3`,documentRevisionId,documentId,ctx.account.id); revision=rows[0]??null; if(!revision)throw new Error("Document revision not found.");}
  const detectedSheetNumber=inferSheetNumber(doc.name); const detectedSheetTitle=inferTitle(doc.name,detectedSheetNumber); const detectedRevision=revision?.revision||"0"; const discipline=disciplineFor(doc.documentType); const confidence=detectedSheetNumber?0.82:0.45;
  const existing=documentRevisionId?await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "PlanRoomDrawingIngestion" WHERE "documentRevisionId"=$1 AND "pageNumber"=$2`,documentRevisionId,pageNumber):await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "PlanRoomDrawingIngestion" WHERE "documentId"=$1 AND "documentRevisionId" IS NULL AND "pageNumber"=$2`,documentId,pageNumber); if(existing[0])throw new Error("This Plan Room revision/page is already in the drawing ingestion queue.");
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "PlanRoomDrawingIngestion" ("id","projectId","accountId","documentId","documentRevisionId","status","discipline","detectedSheetNumber","detectedSheetTitle","detectedRevision","pageNumber","confidence","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,'REVIEW',$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)`,id,projectId,ctx.account.id,documentId,documentRevisionId,discipline,detectedSheetNumber,detectedSheetTitle,detectedRevision,pageNumber,confidence,ctx.user.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"plan_room.drawing_ingestion.queue",detail:`Queued ${doc.name}${revision?` Rev ${revision.revision}`:""} page ${pageNumber} for drawing review`});
  revalidatePath(`/projects/${projectId}/plan-room/drawing-ingestion`); revalidatePath(`/projects/${projectId}/plan-room`);
}

export async function approveDrawingIngestionAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId);
  const ingestionId=s(formData,"ingestionId"); const sheetNumber=s(formData,"sheetNumber").toUpperCase(); const sheetTitle=s(formData,"sheetTitle")||null; const revision=s(formData,"revision")||"0"; const discipline=s(formData,"discipline")||"ELECTRICAL"; let drawingSetId=s(formData,"drawingSetId")||null;
  if(!ingestionId||!sheetNumber)throw new Error("Ingestion item and sheet number are required.");
  const rows=await db.$queryRawUnsafe<Array<{id:string;documentId:string;documentRevisionId:string|null;pageNumber:number|null;status:string}>>(`SELECT "id","documentId","documentRevisionId","pageNumber","status" FROM "PlanRoomDrawingIngestion" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,ingestionId,projectId,ctx.account.id); const item=rows[0]; if(!item)throw new Error("Ingestion item not found."); if(item.status==="INGESTED")throw new Error("This page has already been ingested.");
  const docRows=await db.$queryRawUnsafe<DocRow[]>(`SELECT "id","name","documentType","externalUrl" FROM "ProjectDocument" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,item.documentId,projectId,ctx.account.id); const doc=docRows[0]; if(!doc)throw new Error("Source document is no longer available.");
  const revRows=item.documentRevisionId?await db.$queryRawUnsafe<RevRow[]>(`SELECT "id","documentId","revision","externalUrl","issuedAt" FROM "ProjectDocumentRevision" WHERE "id"=$1 AND "documentId"=$2 AND "accountId"=$3`,item.documentRevisionId,item.documentId,ctx.account.id):[]; const sourceRevision=revRows[0]??null;
  if(drawingSetId){const sets=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "DrawingSet" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,drawingSetId,projectId,ctx.account.id); if(!sets[0])throw new Error("Drawing set not found.");}
  if(!drawingSetId){const existing=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "DrawingSet" WHERE "projectId"=$1 AND "accountId"=$2 AND "name"=$3 LIMIT 1`,projectId,ctx.account.id,`${discipline} · Plan Room`); drawingSetId=existing[0]?.id??randomUUID(); if(!existing[0])await db.$executeRawUnsafe(`INSERT INTO "DrawingSet" ("id","projectId","accountId","name","discipline","description","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,drawingSetId,projectId,ctx.account.id,`${discipline} · Plan Room`,discipline,"Drawing set created from reviewed Plan Room ingestion.",ctx.user.id);}
  const duplicate=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT r."id" FROM "DrawingRevision" r WHERE r."drawingSetId"=$1 AND r."accountId"=$2 AND r."sheetNumber"=$3 AND r."revision"=$4`,drawingSetId,ctx.account.id,sheetNumber,revision); if(duplicate[0])throw new Error("This drawing set already contains the same sheet/revision.");
  const sourceDuplicate=item.documentRevisionId?await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "DrawingRevision" WHERE "sourceDocumentRevisionId"=$1 AND "sourcePageNumber"=$2 AND "accountId"=$3`,item.documentRevisionId,item.pageNumber??1,ctx.account.id):[]; if(sourceDuplicate[0])throw new Error("This exact Plan Room revision/page is already registered as a drawing.");
  const drawingRevisionId=randomUUID(); const externalUrl=sourceRevision?.externalUrl||doc.externalUrl;
  await db.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`INSERT INTO "DrawingRevision" ("id","drawingSetId","accountId","sheetNumber","sheetTitle","revision","issuedAt","sourceDocumentId","sourceDocumentRevisionId","sourcePageNumber","externalUrl") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,drawingRevisionId,drawingSetId,ctx.account.id,sheetNumber,sheetTitle,revision,sourceRevision?.issuedAt??null,doc.id,sourceRevision?.id??null,item.pageNumber??1,externalUrl);
    await tx.$executeRawUnsafe(`UPDATE "PlanRoomDrawingIngestion" SET "status"='INGESTED',"discipline"=$1,"detectedSheetNumber"=$2,"detectedSheetTitle"=$3,"detectedRevision"=$4,"drawingSetId"=$5,"drawingRevisionId"=$6,"errorMessage"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$7 AND "accountId"=$8`,discipline,sheetNumber,sheetTitle,revision,drawingSetId,drawingRevisionId,item.id,ctx.account.id);
    await tx.$executeRawUnsafe(`INSERT INTO "ProjectDocumentAssociation" ("id","documentId","accountId","entityType","entityId","label") VALUES ($1,$2,$3,'DRAWING_REVISION',$4,$5) ON CONFLICT ("documentId","entityType","entityId") DO UPDATE SET "label"=EXCLUDED."label"`,randomUUID(),doc.id,ctx.account.id,drawingRevisionId,`${sheetNumber} Rev ${revision} · page ${item.pageNumber??1}`);
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"plan_room.drawing_ingestion.approve",detail:`Ingested ${doc.name} page ${item.pageNumber??1} as ${sheetNumber} Rev ${revision}`});
  revalidatePath(`/projects/${projectId}/plan-room/drawing-ingestion`); revalidatePath(`/projects/${projectId}/drawings`); revalidatePath(`/projects/${projectId}/drawings/viewer`); revalidatePath(`/projects/${projectId}/plan-room`);
}
