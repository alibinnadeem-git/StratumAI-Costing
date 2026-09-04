"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { addAssemblyComponent, createAssembly, createDrawingLayer, createDrawingRevision, createDrawingSet, createSpatialObject, linkSpatialToEstimate, verifySpatialObject } from "@/lib/drawing-native";

const s=(f:FormData,k:string)=>String(f.get(k)??"").trim();
const n=(f:FormData,k:string)=>{const v=Number(f.get(k)); return Number.isFinite(v)?v:0;};

async function projectCtx(projectId:string){
  const ctx=await requireAccountRole("MEMBER");
  const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});
  if(!project) throw new Error("Project not found in this account.");
  return {ctx,project};
}

export async function createDrawingSetAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const name=s(formData,"name"); if(!name) throw new Error("Drawing set name is required.");
  await createDrawingSet({projectId,accountId:ctx.account.id,name,discipline:s(formData,"discipline")||"ELECTRICAL",description:s(formData,"description")||null,createdById:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.set.create",detail:`Created drawing set ${name}`});
  revalidatePath(`/projects/${projectId}/drawings`);
}

export async function createDrawingRevisionAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const drawingSetId=s(formData,"drawingSetId"); const sheetNumber=s(formData,"sheetNumber"); if(!drawingSetId||!sheetNumber) throw new Error("Drawing set and sheet number are required.");
  const set=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "DrawingSet" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,drawingSetId,projectId,ctx.account.id); if(!set[0]) throw new Error("Drawing set not found.");
  await createDrawingRevision({drawingSetId,accountId:ctx.account.id,sheetNumber,sheetTitle:s(formData,"sheetTitle")||null,revision:s(formData,"revision")||"0",issuedAt:s(formData,"issuedAt")?new Date(s(formData,"issuedAt")):null,sourceDocumentId:s(formData,"sourceDocumentId")||null,externalUrl:s(formData,"externalUrl")||null,scaleLabel:s(formData,"scaleLabel")||null,scaleNumerator:n(formData,"scaleNumerator")||null,scaleDenominator:n(formData,"scaleDenominator")||null});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.revision.create",detail:`Registered ${sheetNumber} revision ${s(formData,"revision")||"0"}`});
  revalidatePath(`/projects/${projectId}/drawings`);
}

export async function createDrawingLayerAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const name=s(formData,"name"); if(!name) throw new Error("Layer name is required.");
  await createDrawingLayer({projectId,accountId:ctx.account.id,name,category:s(formData,"category")||"CONSTRUCTION",systemCode:s(formData,"systemCode")||null});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.layer.create",detail:`Created layer ${name}`});
  revalidatePath(`/projects/${projectId}/drawings`);
}

export async function createTakeoffObjectAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const drawingRevisionId=s(formData,"drawingRevisionId"); const objectType=s(formData,"objectType").toUpperCase(); const name=s(formData,"name"); if(!drawingRevisionId||!name) throw new Error("Sheet and object name are required.");
  if(!["COUNT","LINEAR","AREA"].includes(objectType)) throw new Error("Unsupported takeoff type.");
  const revision=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT r."id" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND s."projectId"=$2 AND r."accountId"=$3`,drawingRevisionId,projectId,ctx.account.id); if(!revision[0]) throw new Error("Drawing revision not found.");
  const layerId=s(formData,"layerId")||null; if(layerId){const layer=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "DrawingLayer" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,layerId,projectId,ctx.account.id); if(!layer[0]) throw new Error("Layer not found.");}
  const measurement=n(formData,"measurement"); const quantity=objectType==="COUNT"?Math.max(1,n(formData,"quantity")||1):Math.max(0,measurement); const unit=s(formData,"unit")||(objectType==="COUNT"?"EA":objectType==="LINEAR"?"LF":"SF");
  const x=n(formData,"x"),y=n(formData,"y"),x2=n(formData,"x2"),y2=n(formData,"y2"); const geometryJson=objectType==="COUNT"?{type:"Point",x,y}:objectType==="LINEAR"?{type:"LineString",points:[{x,y},{x:x2,y:y2}]}:{type:"Polygon",points:[{x,y},{x:x2,y},{x:x2,y:y2},{x,y:y2}]};
  const id=await createSpatialObject({projectId,accountId:ctx.account.id,drawingRevisionId,layerId,objectType,name,description:s(formData,"description")||null,quantity,unit,measurement:objectType==="COUNT"?null:measurement,geometryJson,source:"MANUAL",createdById:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.spatial.create",detail:`Created ${objectType} takeoff ${name} (${id})`});
  revalidatePath(`/projects/${projectId}/drawings`);
}

export async function verifyTakeoffObjectAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const objectId=s(formData,"objectId");
  await verifySpatialObject({objectId,accountId:ctx.account.id,userId:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.spatial.verify",detail:`Verified spatial takeoff ${objectId}`});
  revalidatePath(`/projects/${projectId}/drawings`);
}

export async function linkSpatialEstimateAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const spatialObjectId=s(formData,"spatialObjectId"); const estimateLineId=s(formData,"estimateLineId"); if(!spatialObjectId||!estimateLineId) throw new Error("Spatial object and estimate line are required.");
  const valid=await db.$queryRawUnsafe<Array<{ok:number}>>(`SELECT 1 AS ok FROM "SpatialTakeoffObject" o JOIN "EstimateLineItem" l ON l."id"=$2 JOIN "CostEstimate" e ON e."id"=l."estimateId" WHERE o."id"=$1 AND o."projectId"=$3 AND o."accountId"=$4 AND e."projectId"=$3 AND e."accountId"=$4 LIMIT 1`,spatialObjectId,estimateLineId,projectId,ctx.account.id); if(!valid[0]) throw new Error("Object and estimate line must belong to this project/account.");
  await linkSpatialToEstimate({spatialObjectId,estimateLineId,accountId:ctx.account.id,quantityBasis:n(formData,"quantityBasis")||null});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.estimate.link",detail:`Linked spatial object ${spatialObjectId} to estimate line ${estimateLineId}`});
  revalidatePath(`/projects/${projectId}/drawings`);
}

export async function createAssemblyAction(formData:FormData){
  const ctx=await requireAccountRole("MEMBER"); const name=s(formData,"name"); if(!name) throw new Error("Assembly name is required.");
  await createAssembly({accountId:ctx.account.id,name,category:s(formData,"category")||null,description:s(formData,"description")||null,baseUnit:s(formData,"baseUnit")||"EA",createdById:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,action:"assembly.create",detail:`Created assembly ${name}`});
  revalidatePath("/costing/assemblies");
}

export async function addAssemblyComponentAction(formData:FormData){
  const ctx=await requireAccountRole("MEMBER"); const assemblyId=s(formData,"assemblyId"); const description=s(formData,"description"); if(!assemblyId||!description) throw new Error("Assembly and component description are required.");
  const a=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "AssemblyDefinition" WHERE "id"=$1 AND "accountId"=$2`,assemblyId,ctx.account.id); if(!a[0]) throw new Error("Assembly not found.");
  const costItemId=s(formData,"costItemId")||null; if(costItemId){const item=await db.costItem.findFirst({where:{id:costItemId,accountId:ctx.account.id}}); if(!item) throw new Error("Cost item not found.");}
  await addAssemblyComponent({assemblyId,costItemId,description,quantityFactor:Math.max(0,n(formData,"quantityFactor")||1),unit:s(formData,"unit")||"EA",materialCost:Math.max(0,n(formData,"materialCost")),laborHours:Math.max(0,n(formData,"laborHours"))});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,action:"assembly.component.add",detail:`Added ${description} to assembly ${assemblyId}`});
  revalidatePath("/costing/assemblies");
}
