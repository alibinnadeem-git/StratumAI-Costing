"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { createSpatialAnnotation, updateAnnotationState } from "@/lib/spatial-context";

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
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.create",detail:`Created ${contextType} annotation ${title} (${id})`});revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/drawings/viewer`);
}
export async function setAnnotationStatusAction(projectId:string,formData:FormData){const {ctx}=await projectCtx(projectId);const annotationId=s(formData,"annotationId"),status=s(formData,"status");if(!annotationId||!["OPEN","IN_REVIEW","RESOLVED","VOID"].includes(status))throw new Error("Invalid annotation status.");await updateAnnotationState({annotationId,accountId:ctx.account.id,userId:ctx.user.id,status,reason:s(formData,"reason")||null});await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.status",detail:`Annotation ${annotationId} → ${status}`});revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/drawings/viewer`);}
