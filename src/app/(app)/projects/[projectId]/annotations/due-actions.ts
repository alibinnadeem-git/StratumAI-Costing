"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

const s=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();

export async function setAnnotationDueDateAction(projectId:string,formData:FormData){
  const ctx=await requireAccountRole("MEMBER");
  const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)throw new Error("Project not found in this account.");
  const annotationId=s(formData,"annotationId");const due=s(formData,"dueAt");if(!annotationId)throw new Error("Annotation is required.");
  const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "SpatialAnnotation" WHERE "id"=$1 AND "projectId"=$2 AND "accountId"=$3`,annotationId,projectId,ctx.account.id);if(!rows[0])throw new Error("Annotation not found.");
  const dueAt=due?new Date(`${due}T17:00:00`):null;if(due&&Number.isNaN(dueAt?.getTime()))throw new Error("Invalid due date.");
  await db.$executeRawUnsafe(`UPDATE "SpatialAnnotation" SET "dueAt"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "accountId"=$3`,dueAt,annotationId,ctx.account.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"spatial.annotation.due",detail:`Annotation ${annotationId} due ${dueAt?dueAt.toISOString().slice(0,10):"cleared"}`});
  revalidatePath(`/projects/${projectId}/annotations`);revalidatePath(`/projects/${projectId}/commercial`);
}
