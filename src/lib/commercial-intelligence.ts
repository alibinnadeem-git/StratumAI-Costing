import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export type RfiCommercialImpactRecord = {
  id: string;
  rfiId: string;
  accountId: string;
  classification: "NONE" | "POTENTIAL" | "CONFIRMED";
  costImpact: number;
  scheduleDays: number;
  laborHoursImpact: number;
  notes: string | null;
  updatedAt: Date;
};

export type SupplierLeadTimeRecord = {
  id: string;
  supplierId: string;
  accountId: string;
  category: string;
  leadTimeDays: number;
  asOf: Date;
  validUntil: Date | null;
  source: string | null;
  notes: string | null;
  updatedAt: Date;
};

export type RfqEstimateTrace = {
  rfqId: string;
  estimateId: string;
  estimateNumber: number;
  estimateName: string;
};

export async function getRfiCommercialImpacts(accountId: string, rfiIds: string[]) {
  if (!rfiIds.length) return [] as RfiCommercialImpactRecord[];
  try {
    return await db.$queryRawUnsafe<RfiCommercialImpactRecord[]>(
      `SELECT * FROM "RfiCommercialImpact" WHERE "accountId" = $1 AND "rfiId" = ANY($2::text[])`,
      accountId,
      rfiIds,
    );
  } catch {
    return [];
  }
}

export async function upsertRfiCommercialImpact(input: {
  accountId: string;
  rfiId: string;
  classification: "NONE" | "POTENTIAL" | "CONFIRMED";
  costImpact: number;
  scheduleDays: number;
  laborHoursImpact: number;
  notes?: string | null;
  createdById?: string | null;
}) {
  const id = randomUUID();
  return db.$executeRawUnsafe(
    `INSERT INTO "RfiCommercialImpact" ("id","rfiId","accountId","classification","costImpact","scheduleDays","laborHoursImpact","notes","createdById","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)
     ON CONFLICT ("rfiId") DO UPDATE SET
       "classification" = EXCLUDED."classification",
       "costImpact" = EXCLUDED."costImpact",
       "scheduleDays" = EXCLUDED."scheduleDays",
       "laborHoursImpact" = EXCLUDED."laborHoursImpact",
       "notes" = EXCLUDED."notes",
       "updatedAt" = CURRENT_TIMESTAMP`,
    id,
    input.rfiId,
    input.accountId,
    input.classification,
    input.costImpact,
    input.scheduleDays,
    input.laborHoursImpact,
    input.notes ?? null,
    input.createdById ?? null,
  );
}

export async function getSupplierLeadTimes(accountId: string, supplierIds?: string[]) {
  try {
    if (supplierIds?.length) {
      return await db.$queryRawUnsafe<SupplierLeadTimeRecord[]>(
        `SELECT * FROM "SupplierLeadTime" WHERE "accountId" = $1 AND "supplierId" = ANY($2::text[]) ORDER BY "leadTimeDays" DESC, "category" ASC`,
        accountId,
        supplierIds,
      );
    }
    return await db.$queryRawUnsafe<SupplierLeadTimeRecord[]>(
      `SELECT * FROM "SupplierLeadTime" WHERE "accountId" = $1 ORDER BY "leadTimeDays" DESC, "category" ASC`,
      accountId,
    );
  } catch {
    return [];
  }
}

export async function upsertSupplierLeadTime(input: {
  accountId: string;
  supplierId: string;
  category: string;
  leadTimeDays: number;
  asOf: Date;
  validUntil?: Date | null;
  source?: string | null;
  notes?: string | null;
  createdById?: string | null;
}) {
  const id = randomUUID();
  return db.$executeRawUnsafe(
    `INSERT INTO "SupplierLeadTime" ("id","supplierId","accountId","category","leadTimeDays","asOf","validUntil","source","notes","createdById","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)
     ON CONFLICT ("supplierId","category") DO UPDATE SET
       "leadTimeDays" = EXCLUDED."leadTimeDays",
       "asOf" = EXCLUDED."asOf",
       "validUntil" = EXCLUDED."validUntil",
       "source" = EXCLUDED."source",
       "notes" = EXCLUDED."notes",
       "updatedAt" = CURRENT_TIMESTAMP`,
    id,
    input.supplierId,
    input.accountId,
    input.category,
    input.leadTimeDays,
    input.asOf,
    input.validUntil ?? null,
    input.source ?? null,
    input.notes ?? null,
    input.createdById ?? null,
  );
}

export async function linkRfqToEstimate(accountId: string, rfqId: string, estimateId: string) {
  return db.$executeRawUnsafe(
    `INSERT INTO "RfqEstimateLink" ("id","rfqId","estimateId","accountId") VALUES ($1,$2,$3,$4)
     ON CONFLICT ("rfqId") DO UPDATE SET "estimateId" = EXCLUDED."estimateId", "accountId" = EXCLUDED."accountId"`,
    randomUUID(), rfqId, estimateId, accountId,
  );
}

export async function linkRfqLineToEstimateLine(accountId: string, rfqLineItemId: string, estimateLineItemId: string) {
  return db.$executeRawUnsafe(
    `INSERT INTO "RfqLineEstimateLink" ("id","rfqLineItemId","estimateLineItemId","accountId") VALUES ($1,$2,$3,$4)
     ON CONFLICT ("rfqLineItemId") DO UPDATE SET "estimateLineItemId" = EXCLUDED."estimateLineItemId", "accountId" = EXCLUDED."accountId"`,
    randomUUID(), rfqLineItemId, estimateLineItemId, accountId,
  );
}

export async function linkSupplierQuoteToRfq(input: { accountId: string; quoteId: string; rfqId: string; supplierId?: string | null }) {
  return db.$executeRawUnsafe(
    `INSERT INTO "SupplierQuoteRfqLink" ("id","quoteId","rfqId","supplierId","accountId") VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT ("quoteId") DO UPDATE SET "rfqId" = EXCLUDED."rfqId", "supplierId" = EXCLUDED."supplierId", "accountId" = EXCLUDED."accountId"`,
    randomUUID(), input.quoteId, input.rfqId, input.supplierId ?? null, input.accountId,
  );
}

export async function getRfqEstimateTraces(accountId: string, rfqIds: string[]) {
  if (!rfqIds.length) return [] as RfqEstimateTrace[];
  try {
    return await db.$queryRawUnsafe<RfqEstimateTrace[]>(
      `SELECT l."rfqId", e."id" AS "estimateId", e."number" AS "estimateNumber", e."name" AS "estimateName"
       FROM "RfqEstimateLink" l
       JOIN "CostEstimate" e ON e."id" = l."estimateId"
       WHERE l."accountId" = $1 AND l."rfqId" = ANY($2::text[])`,
      accountId,
      rfqIds,
    );
  } catch {
    return [];
  }
}
