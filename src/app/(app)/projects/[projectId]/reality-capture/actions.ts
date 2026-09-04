"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";
import { createRealityCaptureSpace } from "@/lib/spatial-context";

const s=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
function normalizeMatterport(url:string){
  try{const u=new URL(url);const modelId=u.searchParams.get("m")||u.pathname.split("/").filter(Boolean).pop()||null;const embed=u.toString();return{modelId,embedUrl:embed};}catch{return{modelId:null,embedUrl:url};}
}
export async function registerRealityCaptureAction(projectId:string,formData:FormData){
  const ctx=await requireAccountRole("MEMBER");const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)throw new Error("Project not found in this account.");
  const name=s(formData,"name"),externalUrl=s(formData,"externalUrl"),provider=s(formData,"provider")||"MATTERPORT";if(!name||!externalUrl)throw new Error("Name and capture URL are required.");
  const normalized=provider==="MATTERPORT"?normalizeMatterport(externalUrl):{modelId:null,embedUrl:externalUrl};
  const id=await createRealityCaptureSpace({projectId,accountId:ctx.account.id,provider,name,modelId:normalized.modelId,externalUrl,embedUrl:normalized.embedUrl,capturedAt:s(formData,"capturedAt")?new Date(`${s(formData,"capturedAt")}T12:00:00`):null,description:s(formData,"description")||null,createdById:ctx.user.id});
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"reality_capture.register",detail:`Registered ${provider} spatial capture ${name} (${id})`});revalidatePath(`/projects/${projectId}/reality-capture`);revalidatePath(`/projects/${projectId}/annotations`);
}
