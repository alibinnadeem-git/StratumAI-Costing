import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export type DrawingSetRow = { id:string; projectId:string; accountId:string; name:string; discipline:string; description:string|null; createdAt:Date; updatedAt:Date };
export type DrawingRevisionRow = { id:string; drawingSetId:string; accountId:string; sheetNumber:string; sheetTitle:string|null; revision:string; issuedAt:Date|null; sourceDocumentId:string|null; externalUrl:string|null; width:number|null; height:number|null; scaleLabel:string|null; scaleNumerator:number|null; scaleDenominator:number|null; createdAt:Date };
export type DrawingLayerRow = { id:string; projectId:string; accountId:string; name:string; category:string; systemCode:string|null; isVisibleDefault:boolean; sortOrder:number; createdAt:Date };
export type SpatialTakeoffRow = { id:string; projectId:string; accountId:string; drawingRevisionId:string; layerId:string|null; objectType:string; name:string; description:string|null; quantity:number; unit:string; geometryJson:unknown; measurement:number|null; confidence:number|null; source:string; verifiedById:string|null; verifiedAt:Date|null; createdById:string|null; createdAt:Date; updatedAt:Date };
export type AssemblyRow = { id:string; accountId:string; name:string; category:string|null; description:string|null; baseUnit:string; createdAt:Date; updatedAt:Date };
export type AssemblyComponentRow = { id:string; assemblyId:string; costItemId:string|null; description:string; quantityFactor:number; unit:string; materialCost:number; laborHours:number; createdAt:Date };

export async function getDrawingWorkspace(projectId:string, accountId:string) {
  const [sets,revisions,layers,objects] = await Promise.all([
    db.$queryRawUnsafe<DrawingSetRow[]>(`SELECT * FROM "DrawingSet" WHERE "projectId"=$1 AND "accountId"=$2 ORDER BY "createdAt" DESC`,projectId,accountId),
    db.$queryRawUnsafe<DrawingRevisionRow[]>(`SELECT r.* FROM "DrawingRevision" r JOIN "DrawingSet" s ON s."id"=r."drawingSetId" WHERE s."projectId"=$1 AND r."accountId"=$2 ORDER BY r."createdAt" DESC`,projectId,accountId),
    db.$queryRawUnsafe<DrawingLayerRow[]>(`SELECT * FROM "DrawingLayer" WHERE "projectId"=$1 AND "accountId"=$2 ORDER BY "sortOrder","name"`,projectId,accountId),
    db.$queryRawUnsafe<SpatialTakeoffRow[]>(`SELECT * FROM "SpatialTakeoffObject" WHERE "projectId"=$1 AND "accountId"=$2 ORDER BY "createdAt" DESC`,projectId,accountId),
  ]);
  return {sets,revisions,layers,objects};
}

export async function getAssemblies(accountId:string){
  const assemblies=await db.$queryRawUnsafe<AssemblyRow[]>(`SELECT * FROM "AssemblyDefinition" WHERE "accountId"=$1 ORDER BY "name"`,accountId);
  const components=await db.$queryRawUnsafe<AssemblyComponentRow[]>(`SELECT c.* FROM "AssemblyComponent" c JOIN "AssemblyDefinition" a ON a."id"=c."assemblyId" WHERE a."accountId"=$1 ORDER BY c."createdAt"`,accountId);
  return {assemblies,components};
}

export async function createDrawingSet(input:{projectId:string;accountId:string;name:string;discipline?:string;description?:string|null;createdById?:string|null}){
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "DrawingSet" ("id","projectId","accountId","name","discipline","description","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,id,input.projectId,input.accountId,input.name,input.discipline||"ELECTRICAL",input.description??null,input.createdById??null);
  return id;
}

export async function createDrawingRevision(input:{drawingSetId:string;accountId:string;sheetNumber:string;sheetTitle?:string|null;revision?:string;issuedAt?:Date|null;sourceDocumentId?:string|null;externalUrl?:string|null;scaleLabel?:string|null;scaleNumerator?:number|null;scaleDenominator?:number|null}){
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "DrawingRevision" ("id","drawingSetId","accountId","sheetNumber","sheetTitle","revision","issuedAt","sourceDocumentId","externalUrl","scaleLabel","scaleNumerator","scaleDenominator") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,id,input.drawingSetId,input.accountId,input.sheetNumber,input.sheetTitle??null,input.revision||"0",input.issuedAt??null,input.sourceDocumentId??null,input.externalUrl??null,input.scaleLabel??null,input.scaleNumerator??null,input.scaleDenominator??null);
  return id;
}

export async function createDrawingLayer(input:{projectId:string;accountId:string;name:string;category?:string;systemCode?:string|null}){
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "DrawingLayer" ("id","projectId","accountId","name","category","systemCode") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("projectId","name") DO NOTHING`,id,input.projectId,input.accountId,input.name,input.category||"CONSTRUCTION",input.systemCode??null);
  return id;
}

export async function createSpatialObject(input:{projectId:string;accountId:string;drawingRevisionId:string;layerId?:string|null;objectType:string;name:string;description?:string|null;quantity?:number;unit?:string;measurement?:number|null;geometryJson?:unknown;source?:string;createdById?:string|null}){
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "SpatialTakeoffObject" ("id","projectId","accountId","drawingRevisionId","layerId","objectType","name","description","quantity","unit","measurement","geometryJson","source","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,CURRENT_TIMESTAMP)`,id,input.projectId,input.accountId,input.drawingRevisionId,input.layerId??null,input.objectType,input.name,input.description??null,input.quantity??1,input.unit||"EA",input.measurement??null,JSON.stringify(input.geometryJson??null),input.source||"MANUAL",input.createdById??null);
  return id;
}

export async function verifySpatialObject(input:{objectId:string;accountId:string;userId:string}){
  await db.$executeRawUnsafe(`UPDATE "SpatialTakeoffObject" SET "verifiedById"=$1,"verifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "accountId"=$3`,input.userId,input.objectId,input.accountId);
}

export async function linkSpatialToEstimate(input:{spatialObjectId:string;estimateLineId:string;accountId:string;quantityBasis?:number|null}){
  await db.$executeRawUnsafe(`INSERT INTO "SpatialEstimateLink" ("id","accountId","spatialObjectId","estimateLineId","quantityBasis") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("spatialObjectId","estimateLineId") DO UPDATE SET "quantityBasis"=EXCLUDED."quantityBasis"`,randomUUID(),input.accountId,input.spatialObjectId,input.estimateLineId,input.quantityBasis??null);
}

export async function createAssembly(input:{accountId:string;name:string;category?:string|null;description?:string|null;baseUnit?:string;createdById?:string|null}){
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "AssemblyDefinition" ("id","accountId","name","category","description","baseUnit","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,id,input.accountId,input.name,input.category??null,input.description??null,input.baseUnit||"EA",input.createdById??null);
  return id;
}

export async function addAssemblyComponent(input:{assemblyId:string;costItemId?:string|null;description:string;quantityFactor?:number;unit?:string;materialCost?:number;laborHours?:number}){
  await db.$executeRawUnsafe(`INSERT INTO "AssemblyComponent" ("id","assemblyId","costItemId","description","quantityFactor","unit","materialCost","laborHours") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,randomUUID(),input.assemblyId,input.costItemId??null,input.description,input.quantityFactor??1,input.unit||"EA",input.materialCost??0,input.laborHours??0);
}
