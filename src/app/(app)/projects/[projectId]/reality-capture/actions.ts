"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { createRealityCaptureSpace } from "@/lib/spatial-context";

const s=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
function normalizeMatterport(url:string){try{const u=new URL(url);const modelId=u.searchParams.get("m")||u.pathname.split("/").filter(Boolean).pop()||null;return{modelId,embedUrl:u.toString()};}catch{return{modelId:null,embedUrl:url};}}
function parseJson(raw:string,label:string){if(!raw)return null;try{return JSON.parse(raw) as unknown;}catch{throw new Error(`${label} must be valid JSON.`);}}
function validUnit(n:unknown){return typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1;}
function validateDrawingGeometry(raw:unknown){if(raw==null)return null;if(!raw||typeof raw!=="object")throw new Error("Drawing region is invalid.");const g=raw as Record<string,unknown>;if(g.type==="Point"&&validUnit(g.x)&&validUnit(g.y))return g;if(g.type==="Rectangle"&&validUnit(g.x1)&&validUnit(g.y1)&&validUnit(g.x2)&&validUnit(g.y2))return g;if(g.type==="Polygon"&&Array.isArray(g.points)&&g.points.length>=3&&g.points.every(p=>p&&typeof p==="object"&&validUnit((p as Record<string,unknown>).x)&&validUnit((p as Record<string,unknown>).y)))return g;throw new Error("Drawing region must be a normalized point, rectangle, or polygon.");}
export async function registerRealityCaptureAction(projectId:string,formData:FormData){const ctx=await requireAccountRole("MEMBER");const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)throw new Error("Project not found in this account.");const name=s(formData,"name"),externalUrl=s(formData,"externalUrl"),provider=s(formData,"provider")||"MATTERPORT";if(!name||!externalUrl)throw new Error("Name and capture URL are required.");const normalized=provider==="MATTERPORT"?normalizeMatterport(externalUrl):{modelId:null,embedUrl:externalUrl};const id=await createRealityCaptureSpace({projectId,accountId:ctx.account.id,provider,name,modelId:normalized.modelId,externalUrl,embedUrl:normalized.embedUrl,capturedAt:s(formData,"capturedAt")?new Date(`${s(formData,"capturedAt")}T12:00:00`):null,description:s(formData,"description")||null,createdById:ctx.user.id});await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"reality_capture.register",detail:`Registered ${provider} spatial capture ${name} (${id})`});revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/annotations`);}
export async function createSpatialContextLinkAction(projectId:string,formData:FormData){
  const ctx=await requireAccountRole("MEMBER");
  const drawingRevisionId=s(formData,"drawingRevisionId"),realityCaptureSpaceId=s(formData,"realityCaptureSpaceId");
  if(!drawingRevisionId||!realityCaptureSpaceId)throw new Error("Drawing revision and reality capture are required.");
  const [drawings,captures]=await Promise.all([
    db.$queryRawUnsafe<Array<{id:string}>>(`SELECT r."id" FROM "DrawingRevision" r JOIN "DrawingSet" ds ON ds."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND ds."projectId"=$3`,drawingRevisionId,ctx.account.id,projectId),
    db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "RealityCaptureSpace" WHERE "id"=$1 AND "accountId"=$2 AND "projectId"=$3`,realityCaptureSpaceId,ctx.account.id,projectId),
  ]);
  if(!drawings[0]||!captures[0])throw new Error("Spatial link targets must belong to this project and account.");
  const pose= parseJson(s(formData,"matterportPoseJson"),"Matterport pose");
  const geometry=validateDrawingGeometry(parseJson(s(formData,"drawingGeometryJson"),"Drawing region"));
  if(!pose&&!geometry)throw new Error("Capture a Matterport viewpoint or drawing region before saving the spatial link.");
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "SpatialContextLink" ("id","projectId","accountId","drawingRevisionId","realityCaptureSpaceId","label","drawingGeometryJson","matterportPoseJson","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,id,projectId,ctx.account.id,drawingRevisionId,realityCaptureSpaceId,s(formData,"label")||null,JSON.stringify(geometry),JSON.stringify(pose),ctx.user.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.context.link",detail:`Linked Matterport/capture ${realityCaptureSpaceId} to drawing ${drawingRevisionId} with spatial region/pose (${id})`});
  revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/drawings/markup`);revalidatePath(`/projects/${projectId}/drawings/viewer`);
}
