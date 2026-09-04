"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

export async function saveDrawingViewAction(projectId:string,revisionId:string,input:{rotationDegrees:number;cropJson?:unknown|null}){
  const ctx=await requireAccountRole("MEMBER");
  const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT r."id" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,revisionId,ctx.account.id,projectId);
  if(!rows[0])throw new Error("Drawing revision not found in this project.");
  const rotation=[0,90,180,270].includes(input.rotationDegrees)?input.rotationDegrees:0;
  await db.$executeRawUnsafe(`UPDATE "DrawingRevision" SET "rotationDegrees"=$1,"cropJson"=$2::jsonb,"viewUpdatedAt"=CURRENT_TIMESTAMP WHERE "id"=$3 AND "accountId"=$4`,rotation,JSON.stringify(input.cropJson??null),revisionId,ctx.account.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.view.update",detail:`Updated canonical drawing view for revision ${revisionId}: rotation ${rotation}°`});
  revalidatePath(`/projects/${projectId}/drawings/markup`);
  revalidatePath(`/projects/${projectId}/drawings/viewer`);
}
