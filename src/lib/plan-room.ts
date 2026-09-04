import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export type PlanRoomFolder = { id:string; projectId:string; accountId:string; parentId:string|null; name:string; sortOrder:number };
export type PlanRoomDocument = { id:string; projectId:string; accountId:string; folderId:string|null; name:string; documentType:string; status:string; storageProvider:string; storageKey:string|null; externalUrl:string|null; mimeType:string|null; sizeBytes:bigint|null; description:string|null; createdAt:Date; updatedAt:Date };
export type PlanRoomRevision = { id:string; documentId:string; revision:string; externalUrl:string|null; changeSummary:string|null; issuedAt:Date|null; createdAt:Date };

export async function getPlanRoom(projectId:string, accountId:string) {
  try {
    const [folders, documents] = await Promise.all([
      db.$queryRawUnsafe<PlanRoomFolder[]>(`SELECT * FROM "ProjectDocumentFolder" WHERE "projectId"=$1 AND "accountId"=$2 ORDER BY "sortOrder","name"`, projectId, accountId),
      db.$queryRawUnsafe<PlanRoomDocument[]>(`SELECT * FROM "ProjectDocument" WHERE "projectId"=$1 AND "accountId"=$2 ORDER BY "updatedAt" DESC`, projectId, accountId),
    ]);
    return { folders, documents };
  } catch { return { folders: [] as PlanRoomFolder[], documents: [] as PlanRoomDocument[] }; }
}

export async function getDocumentRevisions(documentId:string, accountId:string) {
  try { return await db.$queryRawUnsafe<PlanRoomRevision[]>(`SELECT * FROM "ProjectDocumentRevision" WHERE "documentId"=$1 AND "accountId"=$2 ORDER BY "createdAt" DESC`, documentId, accountId); }
  catch { return []; }
}

export async function createPlanRoomFolder(input:{projectId:string;accountId:string;parentId?:string|null;name:string;createdById?:string|null}) {
  return db.$executeRawUnsafe(`INSERT INTO "ProjectDocumentFolder" ("id","projectId","accountId","parentId","name","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`, randomUUID(), input.projectId, input.accountId, input.parentId??null, input.name, input.createdById??null);
}

export async function createPlanRoomDocument(input:{projectId:string;accountId:string;folderId?:string|null;name:string;documentType:string;externalUrl?:string|null;mimeType?:string|null;description?:string|null;createdById?:string|null}) {
  const id=randomUUID();
  await db.$executeRawUnsafe(`INSERT INTO "ProjectDocument" ("id","projectId","accountId","folderId","name","documentType","externalUrl","mimeType","description","createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)`, id,input.projectId,input.accountId,input.folderId??null,input.name,input.documentType,input.externalUrl??null,input.mimeType??null,input.description??null,input.createdById??null);
  return id;
}

export async function addPlanRoomRevision(input:{documentId:string;accountId:string;revision:string;externalUrl?:string|null;changeSummary?:string|null;issuedAt?:Date|null;createdById?:string|null}) {
  return db.$executeRawUnsafe(`INSERT INTO "ProjectDocumentRevision" ("id","documentId","accountId","revision","externalUrl","changeSummary","issuedAt","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, randomUUID(),input.documentId,input.accountId,input.revision,input.externalUrl??null,input.changeSummary??null,input.issuedAt??null,input.createdById??null);
}

export async function associatePlanRoomDocument(input:{documentId:string;accountId:string;entityType:string;entityId:string;label?:string|null}) {
  return db.$executeRawUnsafe(`INSERT INTO "ProjectDocumentAssociation" ("id","documentId","accountId","entityType","entityId","label") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("documentId","entityType","entityId") DO UPDATE SET "label"=EXCLUDED."label"`,randomUUID(),input.documentId,input.accountId,input.entityType,input.entityId,input.label??null);
}
