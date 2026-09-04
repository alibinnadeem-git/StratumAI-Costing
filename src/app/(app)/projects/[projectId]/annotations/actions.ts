"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { createSpatialAnnotation, updateAnnotationState } from "@/lib/spatial-context";
import { createRfiAction } from "../rfi-actions";
import type { RfiPriority } from "@prisma/client";

const s=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
async function projectCtx(projectId:string){const ctx=await requireAccountRole("MEMBER");const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)throw new Error("Project not found in this account.");return{ctx,project};}

type Pt={x:number;y:number};
const finite01=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1;
const validPoint=(p:unknown):p is Pt=>!!p&&typeof p==="object"&&finite01((p as Pt).x)&&finite01((p as Pt).y);
const distance=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.y-b.y);
function validateGeometry(g:unknown){
  if(!g||typeof g!=="object"||Array.isArray(g))throw new Error("Annotation geometry must be an object.");
  const x=g as Record<string,unknown>;const type=String(x.type??"");
  if(!["Point","Arrow","Rectangle","Cloud","Polygon","Freehand","Text"].includes(type))throw new Error("Unsupported annotation geometry type.");
  if(type==="Point"||type==="Text"){
    if(!finite01(x.x)||!finite01(x.y))throw new Error(`${type} coordinates must be normalized between 0 and 1.`);
    return g;
  }
  if(type==="Arrow"||type==="Rectangle"||type==="Cloud"){
    if(!finite01(x.x1)||!finite01(x.y1)||!finite01(x.x2)||!finite01(x.y2))throw new Error(`${type} coordinates must be normalized between 0 and 1.`);
    const a={x:x.x1,y:x.y1} as Pt,b={x:x.x2,y:x.y2} as Pt;
    if(distance(a,b)<0.00001)throw new Error(`${type} geometry is too small or degenerate.`);
    if((type==="Rectangle"||type==="Cloud")&&(Math.abs(a.x-b.x)<0.00001||Math.abs(a.y-b.y)<0.00001))throw new Error(`${type} must have measurable width and height.`);
    return g;
  }
  if(!Array.isArray(x.points))throw new Error(`${type} requires a points array.`);
  if(x.points.length>(type==="Freehand"?2000:200))throw new Error(`${type} contains too many points.`);
  if(!x.points.every(validPoint))throw new Error(`${type} points must be normalized between 0 and 1.`);
  const points=x.points as Pt[];
  if(type==="Freehand"){
    let hasMovement=false;
    for(let i=1;i<points.length;i++){
      const previous=points[i-1];const current=points[i];
      if(previous&&current&&distance(previous,current)>=0.000001){hasMovement=true;break;}
    }
    if(points.length<2||!hasMovement)throw new Error("Freehand geometry is too small or degenerate.");
    return g;
  }
  if(points.length<3)throw new Error("Polygon requires at least three points.");
  const unique=new Set(points.map(p=>`${p.x.toFixed(6)}:${p.y.toFixed(6)}`));if(unique.size<3)throw new Error("Polygon requires at least three distinct points.");
  let twiceArea=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a&&b)twiceArea+=a.x*b.y-b.x*a.y;}if(Math.abs(twiceArea)<0.000001)throw new Error("Polygon area is too small or degenerate.");
  return g;
}
function parseGeometry(fd:FormData){
  const raw=s(fd,"geometryJson");
  if(raw){if(raw.length>100000)throw new Error("Annotation geometry payload is too large.");let g:unknown;try{g=JSON.parse(raw);}catch{throw new Error("Annotation geometry must be valid JSON.");}return validateGeometry(g);}
  const pointX=s(fd,"pointX"),pointY=s(fd,"pointY");if(!pointX||!pointY)return null;const g={type:"Point",x:Number(pointX),y:Number(pointY)};return validateGeometry(g);
}
function parsePose(raw:string){if(!raw)return null;if(raw.length>50000)throw new Error("Matterport pose payload is too large.");let pose:unknown;try{pose=JSON.parse(raw);}catch{throw new Error("Matterport pose must be valid JSON.");}if(!pose||typeof pose!=="object"||Array.isArray(pose))throw new Error("Matterport pose is invalid.");return pose;}

export async function createAnnotationAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId);const contextType=s(formData,"contextType")||"PROJECT";const drawingRevisionId=s(formData,"drawingRevisionId")||null;const realityCaptureSpaceId=s(formData,"realityCaptureSpaceId")||null;const spatialObjectId=s(formData,"spatialObjectId")||null;const title=s(formData,"title");if(!title)throw new Error("Annotation title is required.");
  if(contextType==="DRAWING"){if(!drawingRevisionId)throw new Error("Drawing revision is required.");const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT r."id" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,drawingRevisionId,ctx.account.id,projectId);if(!rows[0])throw new Error("Drawing revision not found.");}
  if(contextType==="MATTERPORT"){if(!realityCaptureSpaceId)throw new Error("Reality capture is required.");const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "RealityCaptureSpace" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,realityCaptureSpaceId,projectId,ctx.account.id);if(!rows[0])throw new Error("Reality capture not found.");}
  if(!["DRAWING","MATTERPORT","PROJECT"].includes(contextType))throw new Error("Unsupported annotation context.");
  if(spatialObjectId){const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT o."id" FROM "SpatialTakeoffObject" o JOIN "DrawingRevision" r ON r."id"=o."drawingRevisionId" JOIN "DrawingSet" ds ON ds."id"=r."drawingSetId" WHERE o."id"=$1 AND ds."projectId"=$2 AND o."accountId"=$3`,spatialObjectId,projectId,ctx.account.id);if(!rows[0])throw new Error("Spatial takeoff object not found.");}
  const geometryJson=parseGeometry(formData);const matterportPoseJson=parsePose(s(formData,"matterportPoseJson"));
  const id=await createSpatialAnnotation({projectId,accountId:ctx.account.id,contextType,drawingRevisionId,realityCaptureSpaceId,spatialObjectId,annotationType:s(formData,"annotationType")||"NOTE",title,body:s(formData,"body")||null,priority:s(formData,"priority")||"NORMAL",geometryJson,matterportPoseJson,linkedEntityType:s(formData,"linkedEntityType")||null,linkedEntityId:s(formData,"linkedEntityId")||null,createdById:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.create",detail:`Created ${contextType} annotation ${title} (${id})`});revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/drawings/viewer`);revalidatePath(`/projects/${projectId}/drawings/markup`);
}
export async function setAnnotationStatusAction(projectId:string,formData:FormData){const {ctx}=await projectCtx(projectId);const annotationId=s(formData,"annotationId"),status=s(formData,"status");if(!annotationId||!["OPEN","IN_REVIEW","RESOLVED","VOID"].includes(status))throw new Error("Invalid annotation status.");await updateAnnotationState({annotationId,accountId:ctx.account.id,userId:ctx.user.id,status,reason:s(formData,"reason")||null});await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.status",detail:`Annotation ${annotationId} → ${status}`});revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/drawings/viewer`);revalidatePath(`/projects/${projectId}/drawings/markup`);}
export async function assignAnnotationAction(projectId:string,formData:FormData){const {ctx}=await projectCtx(projectId);const annotationId=s(formData,"annotationId"),assignedToId=s(formData,"assignedToId")||null;const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "SpatialAnnotation" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,annotationId,projectId,ctx.account.id);if(!rows[0])throw new Error("Annotation not found.");if(assignedToId){const members=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT u."id" FROM "User" u JOIN "AccountMembership" am ON am."userId"=u."id" WHERE u."id"=$1 AND am."accountId"=$2`,assignedToId,ctx.account.id);if(!members[0])throw new Error("Assignee is not a member of this account.");}await db.$executeRawUnsafe(`UPDATE "SpatialAnnotation" SET "assignedToId"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "accountId"=$3`,assignedToId,annotationId,ctx.account.id);await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.assign",detail:`Annotation ${annotationId} assigned to ${assignedToId||"unassigned"}`});revalidatePath(`/projects/${projectId}/annotations`);}
export async function addAnnotationCommentAction(projectId:string,formData:FormData){const {ctx}=await projectCtx(projectId);const annotationId=s(formData,"annotationId"),body=s(formData,"body");if(!body)throw new Error("Comment is required.");if(body.length>10000)throw new Error("Comment is too long.");const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "SpatialAnnotation" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,annotationId,projectId,ctx.account.id);if(!rows[0])throw new Error("Annotation not found.");await db.$executeRawUnsafe(`INSERT INTO "SpatialAnnotationComment" ("id","annotationId","accountId","body","createdById") VALUES (gen_random_uuid()::text,$1,$2,$3,$4)`,annotationId,ctx.account.id,body,ctx.user.id);await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.comment",detail:`Commented on annotation ${annotationId}`});revalidatePath(`/projects/${projectId}/annotations`);}
export async function createRfiFromAnnotationAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId);const annotationId=s(formData,"annotationId");if(!annotationId)throw new Error("Annotation is required.");
  const rows=await db.$queryRawUnsafe<Array<{id:string;title:string;body:string|null;priority:string;contextType:string;linkedEntityType:string|null;linkedEntityId:string|null;sheetNumber:string|null;sheetTitle:string|null;revision:string|null;captureName:string|null}>>(`SELECT a."id",a."title",a."body",a."priority",a."contextType",a."linkedEntityType",a."linkedEntityId",dr."sheetNumber",dr."sheetTitle",dr."revision",rc."name" AS "captureName" FROM "SpatialAnnotation" a LEFT JOIN "DrawingRevision" dr ON dr."id"=a."drawingRevisionId" LEFT JOIN "RealityCaptureSpace" rc ON rc."id"=a."realityCaptureSpaceId" WHERE a."id"=$1 AND a."projectId"=$2 AND a."accountId"=$3`,annotationId,projectId,ctx.account.id);const a=rows[0];if(!a)throw new Error("Annotation not found.");if(a.linkedEntityType==="RFI"&&a.linkedEntityId)throw new Error("Annotation is already linked to an RFI.");
  const priority:RfiPriority=a.priority==="CRITICAL"||a.priority==="HIGH"?"HIGH":a.priority==="LOW"?"LOW":"NORMAL";
  const context=a.sheetNumber?`${a.sheetNumber}${a.revision?` Rev ${a.revision}`:""}`:a.captureName?`Matterport: ${a.captureName}`:"Project annotation";
  const rfiId=await createRfiAction(projectId,{sheet:a.sheetNumber||undefined,location:a.sheetTitle||a.captureName||undefined,subject:a.title,question:`${a.body||a.title}\n\nSpatial source: ${context}\nAnnotation ID: ${a.id}`,priority});
  await db.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`INSERT INTO "SpatialAnnotationRevision" ("id","annotationId","accountId","title","body","status","priority","geometryJson","matterportPoseJson","reason","editedById") SELECT gen_random_uuid()::text,"id","accountId","title","body","status","priority","geometryJson","matterportPoseJson",$1,$2 FROM "SpatialAnnotation" WHERE "id"=$3 AND "accountId"=$4`,`Converted to RFI ${rfiId}`,ctx.user.id,a.id,ctx.account.id);
    await tx.$executeRawUnsafe(`UPDATE "SpatialAnnotation" SET "linkedEntityType"='RFI',"linkedEntityId"=$1,"status"='IN_REVIEW',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "accountId"=$3`,rfiId,a.id,ctx.account.id);
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.to_rfi",detail:`Converted annotation ${a.id} to RFI ${rfiId} with revision snapshot`});revalidatePath(`/projects/${projectId}`);revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/drawings/markup`);revalidatePath(`/projects/${projectId}/reality-capture`);
}
