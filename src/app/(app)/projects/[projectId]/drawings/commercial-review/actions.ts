"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

function measure(o:{objectType:string;quantity:number;measurement:number|null}){return o.objectType==="COUNT"?o.quantity:(o.measurement??o.quantity);}

export async function applySpatialCommercialDeltaAction(projectId:string,formData:FormData){
  const ctx=await requireAccountRole("MEMBER"); const previousObjectId=String(formData.get("previousObjectId")||""); const currentObjectId=String(formData.get("currentObjectId")||""); const estimateLineId=String(formData.get("estimateLineId")||"");
  if(!previousObjectId||!estimateLineId)throw new Error("Previous spatial object and estimate line are required.");
  const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)throw new Error("Project not found.");
  const previousRows=await db.$queryRawUnsafe<Array<{id:string;drawingRevisionId:string;objectType:string;quantity:number;measurement:number|null;name:string}>>(`SELECT "id","drawingRevisionId","objectType","quantity","measurement","name" FROM "SpatialTakeoffObject" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,previousObjectId,projectId,ctx.account.id);const previous=previousRows[0];if(!previous)throw new Error("Previous spatial object not found.");
  const current=currentObjectId?(await db.$queryRawUnsafe<Array<{id:string;drawingRevisionId:string;objectType:string;quantity:number;measurement:number|null;name:string;verifiedAt:Date|null}>>(`SELECT "id","drawingRevisionId","objectType","quantity","measurement","name","verifiedAt" FROM "SpatialTakeoffObject" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,currentObjectId,projectId,ctx.account.id))[0]:null;
  if(currentObjectId&&!current)throw new Error("Current spatial object not found."); if(current&&!current.verifiedAt)throw new Error("Verify the current-revision takeoff object before propagating it commercially.");
  if(current){const sameSheet=await db.$queryRawUnsafe<Array<{ok:number}>>(`SELECT 1 AS ok FROM "DrawingRevision" a JOIN "DrawingSet" sa ON sa."id"=a."drawingSetId" JOIN "DrawingRevision" b ON b."id"=$2 JOIN "DrawingSet" sb ON sb."id"=b."drawingSetId" WHERE a."id"=$1 AND a."accountId"=$3 AND b."accountId"=$3 AND a."sheetNumber"=b."sheetNumber" AND sa."id"=sb."id"`,previous.drawingRevisionId,current.drawingRevisionId,ctx.account.id);if(!sameSheet[0])throw new Error("Spatial objects are not revisions of the same drawing sheet.");}
  const line=await db.estimateLineItem.findFirst({where:{id:estimateLineId,estimate:{projectId,accountId:ctx.account.id}},include:{estimate:true}});if(!line)throw new Error("Estimate line not found for this project.");if(!["DRAFT","REVIEW"].includes(line.estimate.status))throw new Error("Controlled estimates cannot accept drawing deltas. Create an estimate revision first.");
  const sourceLink=(await db.$queryRawUnsafe<Array<{quantityBasis:number|null}>>(`SELECT "quantityBasis" FROM "SpatialEstimateLink" WHERE "spatialObjectId"=$1 AND "estimateLineId"=$2 AND "accountId"=$3`,previousObjectId,estimateLineId,ctx.account.id))[0];if(!sourceLink)throw new Error("The prior drawing object is not linked to this estimate line.");
  const oldBasis=sourceLink.quantityBasis??measure(previous);if(!(oldBasis>0))throw new Error("The existing commercial quantity basis is invalid.");const targetBasis=current?measure(current):0;const newQuantity=line.quantity*(targetBasis/oldBasis);
  await db.$transaction(async tx=>{await tx.estimateLineItem.update({where:{id:line.id},data:{quantity:newQuantity,notes:`${line.notes?line.notes+"\n":""}Drawing revision propagation: ${previous.name} basis ${oldBasis.toFixed(3)} → ${current?current.name:"REMOVED"} basis ${targetBasis.toFixed(3)}.`}});if(current)await tx.$executeRawUnsafe(`INSERT INTO "SpatialEstimateLink" ("id","accountId","spatialObjectId","estimateLineId","quantityBasis") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("spatialObjectId","estimateLineId") DO UPDATE SET "quantityBasis"=EXCLUDED."quantityBasis"`,randomUUID(),ctx.account.id,current.id,line.id,targetBasis);});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.delta.apply",detail:`Applied reviewed drawing delta to EST-${String(line.estimate.number).padStart(4,"0")} line ${line.description}: quantity ${line.quantity.toFixed(3)} → ${newQuantity.toFixed(3)} from spatial basis ${oldBasis.toFixed(3)} → ${targetBasis.toFixed(3)}`});
  revalidatePath(`/projects/${projectId}/drawings/commercial-review`);revalidatePath(`/projects/${projectId}/drawings/revision-delta`);revalidatePath(`/costing/estimates/${line.estimateId}`);revalidatePath(`/costing/estimates/${line.estimateId}/spatial`);
}
