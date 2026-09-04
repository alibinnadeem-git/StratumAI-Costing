"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

const s=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();

export async function setDrawingRevisionReviewAction(projectId:string,formData:FormData){
  const ctx=await requireAccountRole("MEMBER");
  const revisionId=s(formData,"revisionId");
  const status=s(formData,"status").toUpperCase();
  const note=s(formData,"note").slice(0,4000);
  if(!revisionId||!["PENDING","ACCEPTED","REJECTED"].includes(status)) throw new Error("Invalid drawing revision review request.");
  if(status==="REJECTED"&&!note) throw new Error("A rejection note is required.");

  const revisions=await db.$queryRawUnsafe<Array<{id:string;sheetNumber:string;revision:string;reviewStatus:string}>>(`
    SELECT r."id",r."sheetNumber",r."revision",r."reviewStatus"
    FROM "DrawingRevision" r
    JOIN "DrawingSet" ds ON ds."id"=r."drawingSetId"
    WHERE r."id"=$1 AND r."accountId"=$2 AND ds."projectId"=$3
  `,revisionId,ctx.account.id,projectId);
  const revision=revisions[0];
  if(!revision) throw new Error("Drawing revision not found in this project.");

  if(status==="ACCEPTED"){
    const blockers=await db.$queryRawUnsafe<Array<{count:bigint}>>(`
      SELECT COUNT(*) AS "count"
      FROM "SpatialTakeoffObject" o
      WHERE o."drawingRevisionId"=$1 AND o."accountId"=$2
        AND (
          o."verifiedAt" IS NULL
          OR COALESCE(o."confidence",0)<0.8
          OR (o."objectType" IN ('LINEAR','AREA') AND o."calibrationId" IS NULL)
        )
    `,revisionId,ctx.account.id);
    const blockerCount=Number(blockers[0]?.count??0);
    if(blockerCount>0) throw new Error(`This revision still has ${blockerCount} takeoff QA blocker(s). Resolve them before acceptance.`);
  }

  await db.$executeRawUnsafe(`
    UPDATE "DrawingRevision"
    SET "reviewStatus"=$1,
        "reviewedAt"=CASE WHEN $1='PENDING' THEN NULL ELSE CURRENT_TIMESTAMP END,
        "reviewedById"=CASE WHEN $1='PENDING' THEN NULL ELSE $2 END,
        "reviewNote"=NULLIF($3,'')
    WHERE "id"=$4 AND "accountId"=$5
  `,status,ctx.user.id,note,revisionId,ctx.account.id);

  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.revision.review",detail:`${revision.sheetNumber} R${revision.revision}: ${revision.reviewStatus} → ${status}${note?` · ${note}`:""}`});
  revalidatePath(`/projects/${projectId}/drawings/review`);
  revalidatePath(`/projects/${projectId}/drawings/revision-delta`);
  revalidatePath(`/projects/${projectId}/drawings/viewer`);
  revalidatePath(`/projects/${projectId}/drawings`);
}
