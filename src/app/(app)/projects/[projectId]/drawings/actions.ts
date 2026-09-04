"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { calibratedLinearFeet, calibratedSquareFeet, lineRawMeasurement, rectangleRawArea } from "@/lib/drawing-measurement";
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
  const calibrationRows=await db.$queryRawUnsafe<Array<{id:string;scaleFactor:number;realUnit:string}>>(`SELECT "id","scaleFactor","realUnit" FROM "DrawingCalibration" WHERE "drawingRevisionId"=$1 AND "accountId"=$2 LIMIT 1`,drawingRevisionId,ctx.account.id);
  const calibration=calibrationRows[0]??null;
  const x=n(formData,"x"),y=n(formData,"y"),x2=n(formData,"x2"),y2=n(formData,"y2");
  const geometryJson=objectType==="COUNT"?{type:"Point",x,y}:objectType==="LINEAR"?{type:"LineString",points:[{x,y},{x:x2,y:y2}]}:{type:"Polygon",points:[{x,y},{x:x2,y},{x:x2,y:y2},{x,y:y2}]};
  const manualMeasurement=n(formData,"measurement");
  let rawMeasurement:number|null=null; let measurement:number|null=null; let quantity=1; let unit="EA"; let confidence=0.9; let source="MANUAL";
  if(objectType==="COUNT"){
    quantity=Math.max(1,n(formData,"quantity")||1); unit=s(formData,"unit")||"EA";
  }else if(objectType==="LINEAR"){
    rawMeasurement=lineRawMeasurement({x,y},{x:x2,y:y2});
    if(calibration){measurement=calibratedLinearFeet(rawMeasurement,calibration); unit="LF"; confidence=0.98; source="MANUAL_CALIBRATED";}
    else {measurement=manualMeasurement>0?manualMeasurement:null; unit=s(formData,"unit")||"LF"; confidence=0.6;}
    if(!(measurement&&measurement>0)) throw new Error("Calibrate this sheet or provide a manual linear measurement greater than zero.");
    quantity=measurement;
  }else{
    rawMeasurement=rectangleRawArea({x,y},{x:x2,y:y2});
    if(calibration){measurement=calibratedSquareFeet(rawMeasurement,calibration); unit="SF"; confidence=0.98; source="MANUAL_CALIBRATED";}
    else {measurement=manualMeasurement>0?manualMeasurement:null; unit=s(formData,"unit")||"SF"; confidence=0.6;}
    if(!(measurement&&measurement>0)) throw new Error("Calibrate this sheet or provide a manual area measurement greater than zero.");
    quantity=measurement;
  }
  const id=await createSpatialObject({projectId,accountId:ctx.account.id,drawingRevisionId,layerId,objectType,name,description:s(formData,"description")||null,quantity,unit,measurement,rawMeasurement,calibrationId:calibration?.id??null,calibrationScaleFactor:calibration?.scaleFactor??null,calibrationUnit:calibration?.realUnit??null,confidence,geometryJson,source,createdById:ctx.user.id});
  const basis=calibration&&objectType!=="COUNT"?` calibrated to ${measurement?.toFixed(2)} ${unit}`:objectType==="COUNT"?` ${quantity} ${unit}`:` manual ${measurement?.toFixed(2)} ${unit}`;
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.spatial.create",detail:`Created ${objectType} takeoff ${name} (${id})${basis}`});
  revalidatePath(`/projects/${projectId}/drawings`); revalidatePath(`/projects/${projectId}/drawings/viewer`); revalidatePath(`/projects/${projectId}/drawings/review`);
}

export async function verifyTakeoffObjectAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const objectId=s(formData,"objectId");
  await verifySpatialObject({objectId,accountId:ctx.account.id,userId:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.spatial.verify",detail:`Verified spatial takeoff ${objectId}`});
  revalidatePath(`/projects/${projectId}/drawings`); revalidatePath(`/projects/${projectId}/drawings/viewer`); revalidatePath(`/projects/${projectId}/drawings/review`);
}

export async function linkSpatialEstimateAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId); const spatialObjectId=s(formData,"spatialObjectId"); const estimateLineId=s(formData,"estimateLineId"); if(!spatialObjectId||!estimateLineId) throw new Error("Spatial object and estimate line are required.");
  const valid=await db.$queryRawUnsafe<Array<{ok:number}>>(`SELECT 1 AS ok FROM "SpatialTakeoffObject" o JOIN "EstimateLineItem" l ON l."id"=$2 JOIN "CostEstimate" e ON e."id"=l."estimateId" WHERE o."id"=$1 AND o."projectId"=$3 AND o."accountId"=$4 AND e."projectId"=$3 AND e."accountId"=$4 LIMIT 1`,spatialObjectId,estimateLineId,projectId,ctx.account.id); if(!valid[0]) throw new Error("Object and estimate line must belong to this project/account.");
  await linkSpatialToEstimate({spatialObjectId,estimateLineId,accountId:ctx.account.id,quantityBasis:n(formData,"quantityBasis")||null});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.estimate.link",detail:`Linked spatial object ${spatialObjectId} to estimate line ${estimateLineId}`});
  revalidatePath(`/projects/${projectId}/drawings`); revalidatePath(`/projects/${projectId}/drawings/viewer`);
}

export async function applyAssemblyToEstimateAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId);
  const spatialObjectId=s(formData,"spatialObjectId"); const assemblyId=s(formData,"assemblyId"); const estimateId=s(formData,"estimateId");
  if(!spatialObjectId||!assemblyId||!estimateId) throw new Error("Takeoff object, assembly, and estimate are required.");
  const objects=await db.$queryRawUnsafe<Array<{id:string;name:string;objectType:string;quantity:number;measurement:number|null;unit:string;verifiedAt:Date|null}>>(`SELECT "id","name","objectType","quantity","measurement","unit","verifiedAt" FROM "SpatialTakeoffObject" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,spatialObjectId,projectId,ctx.account.id);
  const object=objects[0]; if(!object) throw new Error("Takeoff object not found."); if(!object.verifiedAt) throw new Error("Verify the takeoff object before converting it to estimate scope.");
  const estimate=await db.costEstimate.findFirst({where:{id:estimateId,projectId,accountId:ctx.account.id}}); if(!estimate) throw new Error("Estimate not found for this project."); if(!["DRAFT","REVIEW"].includes(estimate.status)) throw new Error("Create a revision before adding assembly scope to a controlled estimate.");
  const assemblies=await db.$queryRawUnsafe<Array<{id:string;name:string;category:string|null;baseUnit:string}>>(`SELECT "id","name","category","baseUnit" FROM "AssemblyDefinition" WHERE "id"=$1 AND "accountId"=$2`,assemblyId,ctx.account.id); const assembly=assemblies[0]; if(!assembly) throw new Error("Assembly not found.");
  const components=await db.$queryRawUnsafe<Array<{costItemId:string|null;description:string;quantityFactor:number;unit:string;materialCost:number;laborHours:number}>>(`SELECT "costItemId","description","quantityFactor","unit","materialCost","laborHours" FROM "AssemblyComponent" WHERE "assemblyId"=$1 ORDER BY "createdAt"`,assemblyId); if(!components.length) throw new Error("Add at least one component to the assembly first.");
  const basis=object.objectType==="COUNT"?object.quantity:(object.measurement??object.quantity); if(!(basis>0)) throw new Error("Takeoff measurement must be greater than zero.");
  const existing=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "SpatialAssemblyLink" WHERE "spatialObjectId"=$1 AND "assemblyId"=$2 AND "estimateId"=$3`,spatialObjectId,assemblyId,estimateId); if(existing[0]) throw new Error("This assembly has already been applied to this takeoff object and estimate.");
  const start=await db.estimateLineItem.count({where:{estimateId}});
  const createdIds:string[]=[];
  await db.$transaction(async(tx)=>{
    for(const [i,c] of components.entries()){
      const line=await tx.estimateLineItem.create({data:{estimateId,costItemId:c.costItemId,description:`${assembly.name} · ${c.description}`,category:assembly.category||"Assembly",quantity:basis*c.quantityFactor,unit:c.unit,materialCost:c.materialCost,laborHoursPerUnit:c.laborHours,notes:`Generated from verified drawing takeoff "${object.name}" using assembly "${assembly.name}". Spatial object ${object.id}.`,sortOrder:start+i}}); createdIds.push(line.id);
      await tx.$executeRawUnsafe(`INSERT INTO "SpatialEstimateLink" ("id","accountId","spatialObjectId","estimateLineId","quantityBasis") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("spatialObjectId","estimateLineId") DO NOTHING`,randomUUID(),ctx.account.id,spatialObjectId,line.id,basis);
    }
    await tx.$executeRawUnsafe(`INSERT INTO "SpatialAssemblyLink" ("id","accountId","spatialObjectId","assemblyId","estimateId") VALUES ($1,$2,$3,$4,$5)`,randomUUID(),ctx.account.id,spatialObjectId,assemblyId,estimateId);
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.assembly.apply",detail:`Applied assembly ${assembly.name} to ${object.name}; created ${createdIds.length} estimate line(s) in EST-${String(estimate.number).padStart(4,"0")}`});
  revalidatePath(`/projects/${projectId}/drawings`); revalidatePath(`/costing/estimates/${estimateId}`); revalidatePath(`/projects/${projectId}/drawings/revision-delta`); revalidatePath(`/projects/${projectId}/drawings/viewer`);
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
