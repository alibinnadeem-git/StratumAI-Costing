"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

type Point={x:number;y:number};
type Geometry={type:"Point";x:number;y:number}|{type:"LineString"|"Polygon";points:Point[]};
type Calibration={id:string;scaleFactor:number;realUnit:string};

function pointsFrom(g:Geometry):Point[]{return g.type==="Point"?[{x:g.x,y:g.y}]:g.points;}
function rawLength(points:Point[]){let n=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(a&&b)n+=Math.hypot(b.x-a.x,b.y-a.y);}return n;}
function rawArea(points:Point[]){if(points.length<3)return 0;let s=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a&&b)s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;}
function toFeet(value:number,unit:string){switch(unit.toUpperCase()){case"FT":return value;case"IN":return value/12;case"M":return value*3.280839895;case"MM":return value*0.003280839895;default:return value;}}
function measurementFor(type:string,g:Geometry,c:Calibration|null){
  if(type==="COUNT")return {quantity:1,measurement:null,rawMeasurement:null,unit:"EA",confidence:.98,calibrationId:null,calibrationScaleFactor:null,calibrationUnit:null};
  if(!c)throw new Error("Calibrate this drawing revision before creating or editing measured takeoff in the viewer.");
  const pts=pointsFrom(g); const raw=type==="LINEAR"?rawLength(pts):rawArea(pts); if(!(raw>0))throw new Error("Geometry must have a measurable length or area.");
  const linearFactorFt=toFeet(c.scaleFactor,c.realUnit);
  const measured=type==="LINEAR"?raw*linearFactorFt:raw*linearFactorFt*linearFactorFt;
  return {quantity:measured,measurement:measured,rawMeasurement:raw,unit:type==="LINEAR"?"LF":"SF",confidence:.97,calibrationId:c.id,calibrationScaleFactor:c.scaleFactor,calibrationUnit:c.realUnit};
}
async function projectCtx(projectId:string){const ctx=await requireAccountRole("MEMBER");const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)throw new Error("Project not found in this account.");return {ctx,project};}
async function calibrationFor(drawingRevisionId:string,accountId:string){const rows=await db.$queryRawUnsafe<Calibration[]>(`SELECT "id","scaleFactor","realUnit" FROM "DrawingCalibration" WHERE "drawingRevisionId"=$1 AND "accountId"=$2`,drawingRevisionId,accountId);return rows[0]??null;}
async function assertEditableObject(objectId:string,projectId:string,accountId:string){
  const rows=await db.$queryRawUnsafe<Array<{id:string;drawingRevisionId:string;objectType:string;name:string;geometryJson:Geometry;quantity:number;measurement:number|null;rawMeasurement:number|null;calibrationId:string|null;calibrationScaleFactor:number|null;calibrationUnit:string|null;confidence:number|null}>>(`SELECT "id","drawingRevisionId","objectType","name","geometryJson","quantity","measurement","rawMeasurement","calibrationId","calibrationScaleFactor","calibrationUnit","confidence" FROM "SpatialTakeoffObject" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,objectId,projectId,accountId);
  const object=rows[0];if(!object)throw new Error("Spatial object not found.");
  const controlled=await db.$queryRawUnsafe<Array<{status:string;number:number}>>(`SELECT DISTINCT e."status",e."number" FROM "SpatialEstimateLink" s JOIN "EstimateLineItem" l ON l."id"=s."estimateLineId" JOIN "CostEstimate" e ON e."id"=l."estimateId" WHERE s."spatialObjectId"=$1 AND e."accountId"=$2 AND e."status" IN ('SUBMITTED','AWARDED','LOST','ARCHIVED') LIMIT 1`,objectId,accountId);
  if(controlled[0])throw new Error(`This drawing object feeds controlled EST-${String(controlled[0].number).padStart(4,"0")}. Create a commercial revision before changing its source geometry.`);
  return object;
}

export async function createViewerTakeoffAction(projectId:string,input:{drawingRevisionId:string;layerId:string|null;objectType:"COUNT"|"LINEAR"|"AREA";name:string;geometry:Geometry}){
  const {ctx}=await projectCtx(projectId); const name=input.name.trim(); if(!name)throw new Error("Takeoff name is required.");
  const rev=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT r."id" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,input.drawingRevisionId,ctx.account.id,projectId);if(!rev[0])throw new Error("Drawing revision not found.");
  if(input.layerId){const layer=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "DrawingLayer" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,input.layerId,projectId,ctx.account.id);if(!layer[0])throw new Error("Layer not found.");}
  const calibration=await calibrationFor(input.drawingRevisionId,ctx.account.id); const m=measurementFor(input.objectType,input.geometry,calibration); const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "SpatialTakeoffObject" ("id","projectId","accountId","drawingRevisionId","layerId","objectType","name","quantity","unit","geometryJson","measurement","rawMeasurement","calibrationId","calibrationScaleFactor","calibrationUnit","confidence","source","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,'VIEWER',$17,CURRENT_TIMESTAMP)`,id,projectId,ctx.account.id,input.drawingRevisionId,input.layerId,input.objectType,name,m.quantity,m.unit,JSON.stringify(input.geometry),m.measurement,m.rawMeasurement,m.calibrationId,m.calibrationScaleFactor,m.calibrationUnit,m.confidence,ctx.user.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.viewer.create",detail:`Created ${input.objectType} object ${name} (${id}) from Spatial Viewer`});
  revalidatePath(`/projects/${projectId}/drawings/viewer`);revalidatePath(`/projects/${projectId}/drawings`);revalidatePath(`/projects/${projectId}/drawings/review`);return {id};
}

export async function updateViewerGeometryAction(projectId:string,input:{objectId:string;geometry:Geometry;reason?:string}){
  const {ctx}=await projectCtx(projectId); const object=await assertEditableObject(input.objectId,projectId,ctx.account.id);
  const calibration=object.calibrationId?((await db.$queryRawUnsafe<Calibration[]>(`SELECT "id","scaleFactor","realUnit" FROM "DrawingCalibration" WHERE "id"=$1 AND "accountId"=$2`,object.calibrationId,ctx.account.id))[0]??null):await calibrationFor(object.drawingRevisionId,ctx.account.id);
  const m=measurementFor(object.objectType,input.geometry,calibration);
  await db.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`INSERT INTO "SpatialTakeoffRevision" ("id","spatialObjectId","accountId","geometryJson","quantity","measurement","rawMeasurement","calibrationId","calibrationScaleFactor","calibrationUnit","confidence","reason","editedById") VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,randomUUID(),object.id,ctx.account.id,JSON.stringify(object.geometryJson),object.quantity,object.measurement,object.rawMeasurement,object.calibrationId,object.calibrationScaleFactor,object.calibrationUnit,object.confidence,input.reason?.trim()||"Spatial Viewer geometry edit",ctx.user.id);
    await tx.$executeRawUnsafe(`UPDATE "SpatialTakeoffObject" SET "geometryJson"=$1::jsonb,"quantity"=$2,"unit"=$3,"measurement"=$4,"rawMeasurement"=$5,"calibrationId"=$6,"calibrationScaleFactor"=$7,"calibrationUnit"=$8,"confidence"=$9,"verifiedById"=NULL,"verifiedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$10 AND "accountId"=$11`,JSON.stringify(input.geometry),m.quantity,m.unit,m.measurement,m.rawMeasurement,m.calibrationId,m.calibrationScaleFactor,m.calibrationUnit,m.confidence,object.id,ctx.account.id);
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"takeoff.viewer.geometry_update",detail:`Edited geometry for ${object.name} (${object.id}); verification reset`});
  revalidatePath(`/projects/${projectId}/drawings/viewer`);revalidatePath(`/projects/${projectId}/drawings`);revalidatePath(`/projects/${projectId}/drawings/review`);revalidatePath(`/projects/${projectId}/drawings/revision-delta`);return {ok:true};
}
