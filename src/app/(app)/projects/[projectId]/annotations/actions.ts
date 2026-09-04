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
export async function createAnnotationAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId);const contextType=s(formData,"contextType")||"PROJECT";const drawingRevisionId=s(formData,"drawingRevisionId")||null;const realityCaptureSpaceId=s(formData,"realityCaptureSpaceId")||null;const spatialObjectId=s(formData,"spatialObjectId")||null;const title=s(formData,"title");if(!title)throw new Error("Annotation title is required.");
  if(contextType==="DRAWING"){if(!drawingRevisionId)throw new Error("Drawing revision is required.");const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT r."id" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,drawingRevisionId,ctx.account.id,projectId);if(!rows[0])throw new Error("Drawing revision not found.");}
  if(contextType==="MATTERPORT"){if(!realityCaptureSpaceId)throw new Error("Reality capture is required.");const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "RealityCaptureSpace" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,realityCaptureSpaceId,projectId,ctx.account.id);if(!rows[0])throw new Error("Reality capture not found.");}
  if(spatialObjectId){const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "SpatialTakeoffObject" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,spatialObjectId,projectId,ctx.account.id);if(!rows[0])throw new Error("Spatial takeoff object not found.");}
  const pointX=s(formData,"pointX"),pointY=s(formData,"pointY");const geometryJson=pointX&&pointY?{type:"Point",x:Number(pointX),y:Number(pointY)}:null;
  const poseRaw=s(formData,"matterportPoseJson");let matterportPoseJson:unknown=null;if(poseRaw){try{matterportPoseJson=JSON.parse(poseRaw);}catch{throw new Error("Matterport pose must be valid JSON.");}}
  const id=await createSpatialAnnotation({projectId,accountId:ctx.account.id,contextType,drawingRevisionId,realityCaptureSpaceId,spatialObjectId,annotationType:s(formData,"annotationType")||"NOTE",title,body:s(formData,"body")||null,priority:s(formData,"priority")||"NORMAL",geometryJson,matterportPoseJson,linkedEntityType:s(formData,"linkedEntityType")||null,linkedEntityId:s(formData,"linkedEntityId")||null,createdById:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.create",detail:`Created ${contextType} annotation ${title} (${id})`});revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/drawings/viewer`);revalidatePath(`/projects/${projectId}/drawings/markup`);
}
export async function setAnnotationStatusAction(projectId:string,formData:FormData){const {ctx}=await projectCtx(projectId);const annotationId=s(formData,"annotationId"),status=s(formData,"status");if(!annotationId||!["OPEN","IN_REVIEW","RESOLVED","VOID"].includes(status))throw new Error("Invalid annotation status.");await updateAnnotationState({annotationId,accountId:ctx.account.id,userId:ctx.user.id,status,reason:s(formData,"reason")||null});await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.status",detail:`Annotation ${annotationId} → ${status}`});revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/drawings/viewer`);revalidatePath(`/projects/${projectId}/drawings/markup`);}

export async function createRfiFromAnnotationAction(projectId:string,formData:FormData){
  const {ctx}=await projectCtx(projectId);const annotationId=s(formData,"annotationId");if(!annotationId)throw new Error("Annotation is required.");
  const rows=await db.$queryRawUnsafe<Array<{id:string;title:string;body:string|null;priority:string;contextType:string;linkedEntityType:string|null;linkedEntityId:string|null;sheetNumber:string|null;sheetTitle:string|null;revision:string|null;captureName:string|null}>>(`SELECT a."id",a."title",a."body",a."priority",a."contextType",a."linkedEntityType",a."linkedEntityId",dr."sheetNumber",dr."sheetTitle",dr."revision",rc."name" AS "captureName" FROM "SpatialAnnotation" a LEFT JOIN "DrawingRevision" dr ON dr."id"=a."drawingRevisionId" LEFT JOIN "RealityCaptureSpace" rc ON rc."id"=a."realityCaptureSpaceId" WHERE a."id"=$1 AND a."projectId"=$2 AND a."accountId"=$3`,annotationId,projectId,ctx.account.id);const a=rows[0];if(!a)throw new Error("Annotation not found.");if(a.linkedEntityType==="RFI"&&a.linkedEntityId)throw new Error("Annotation is already linked to an RFI.");
  const priority:RfiPriority=a.priority==="CRITICAL"||a.priority==="HIGH"?"HIGH":a.priority==="LOW"?"LOW":"NORMAL";
  const context=a.sheetNumber?`${a.sheetNumber}${a.revision?` Rev ${a.revision}`:""}`:a.captureName?`Matterport: ${a.captureName}`:"Project annotation";
  const rfiId=await createRfiAction(projectId,{sheet:a.sheetNumber||undefined,location:a.sheetTitle||a.captureName||undefined,subject:a.title,question:`${a.body||a.title}\n\nSpatial source: ${context}\nAnnotation ID: ${a.id}`,priority});
  await db.$executeRawUnsafe(`UPDATE "SpatialAnnotation" SET "linkedEntityType"='RFI',"linkedEntityId"=$1,"status"='IN_REVIEW',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "accountId"=$3`,rfiId,a.id,ctx.account.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.to_rfi",detail:`Converted annotation ${a.id} to RFI ${rfiId}`});revalidatePath(`/projects/${projectId}`);revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/drawings/markup`);revalidatePath(`/projects/${projectId}/reality-capture`);
}
