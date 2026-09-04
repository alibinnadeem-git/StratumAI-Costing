"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { requireAccountRole } from "@/lib/session";

const s=(f:FormData,k:string)=>String(f.get(k)??"").trim();
const n=(f:FormData,k:string)=>{const v=Number(f.get(k)); return Number.isFinite(v)?v:0;};

export async function calibrateDrawingAction(projectId:string,formData:FormData){
  const ctx=await requireAccountRole("MEMBER");
  const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}}); if(!project) throw new Error("Project not found.");
  const drawingRevisionId=s(formData,"drawingRevisionId"); const x1=n(formData,"x1"),y1=n(formData,"y1"),x2=n(formData,"x2"),y2=n(formData,"y2"); const realDistance=n(formData,"realDistance"); const realUnit=s(formData,"realUnit")||"FT";
  if(!drawingRevisionId||!(realDistance>0)) throw new Error("Drawing revision and real distance are required.");
  const rev=await db.$queryRawUnsafe<Array<{id:string;sheetNumber:string;revision:string}>>(`SELECT r."id",r."sheetNumber",r."revision" FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE r."id"=$1 AND r."accountId"=$2 AND s."projectId"=$3`,drawingRevisionId,ctx.account.id,projectId); if(!rev[0]) throw new Error("Drawing revision not found.");
  const coordinateDistance=Math.hypot(x2-x1,y2-y1); if(!(coordinateDistance>0)) throw new Error("Calibration points must be different.");
  const scaleFactor=realDistance/coordinateDistance;
  await db.$executeRawUnsafe(`INSERT INTO "DrawingCalibration" ("id","drawingRevisionId","accountId","x1","y1","x2","y2","realDistance","realUnit","scaleFactor","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP) ON CONFLICT ("drawingRevisionId") DO UPDATE SET "x1"=EXCLUDED."x1","y1"=EXCLUDED."y1","x2"=EXCLUDED."x2","y2"=EXCLUDED."y2","realDistance"=EXCLUDED."realDistance","realUnit"=EXCLUDED."realUnit","scaleFactor"=EXCLUDED."scaleFactor","createdById"=EXCLUDED."createdById","updatedAt"=CURRENT_TIMESTAMP`,randomUUID(),drawingRevisionId,ctx.account.id,x1,y1,x2,y2,realDistance,realUnit,scaleFactor,ctx.user.id);
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId,action:"drawing.calibrate",detail:`Calibrated ${rev[0].sheetNumber} Rev ${rev[0].revision}: ${coordinateDistance.toFixed(3)} drawing units = ${realDistance} ${realUnit}; factor ${scaleFactor.toFixed(6)}`});
  revalidatePath(`/projects/${projectId}/drawings/calibration`); revalidatePath(`/projects/${projectId}/drawings`); revalidatePath(`/projects/${projectId}/drawings/viewer`);
}
