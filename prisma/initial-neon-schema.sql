-- Stratum AI Operations Suite / Stratum AI Costing Tool
-- Initial PostgreSQL schema for Neon. Generated from prisma/schema.prisma.

CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "SystemRole" AS ENUM ('USER', 'SUPER_ADMIN');
CREATE TYPE "RfiStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');
CREATE TYPE "RfiPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED');
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RESPONDED');
CREATE TYPE "CostSource" AS ENUM ('NECA', 'REF', 'MANUAL', 'HIST', 'QUOTE');
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'REVIEW', 'SUBMITTED', 'AWARDED', 'LOST', 'ARCHIVED');
CREATE TYPE "EstimateCondition" AS ENUM ('NORMAL', 'DIFFICULT', 'VERY_DIFFICULT');
CREATE TYPE "AdderType" AS ENUM ('FIXED', 'PERCENT');
CREATE TYPE "AdderBasis" AS ENUM ('DIRECT_COST', 'MATERIAL', 'LABOR');
CREATE TYPE "MarketDirection" AS ENUM ('INCREASE', 'DECREASE');
CREATE TYPE "MarketAffects" AS ENUM ('MATERIAL', 'LABOR', 'ALL');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "systemRole" "SystemRole" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "number" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Rfi" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "sheet" TEXT,
  "location" TEXT,
  "subject" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "response" TEXT,
  "status" "RfiStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "RfiPriority" NOT NULL DEFAULT 'NORMAL',
  "imageDataUrl" TEXT,
  "submittedBy" TEXT,
  "dateSubmitted" TIMESTAMP(3),
  "dateNeeded" TIMESTAMP(3),
  "dateAnswered" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "Rfi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TakeoffImport" (
  "id" TEXT NOT NULL,
  "fileName" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL,
  "importedById" TEXT,
  CONSTRAINT "TakeoffImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TakeoffItem" (
  "id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "count" INTEGER,
  "length" TEXT,
  "area" TEXT,
  "description" TEXT,
  "unit" TEXT DEFAULT 'EA',
  "takeoffImportId" TEXT NOT NULL,
  CONSTRAINT "TakeoffItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Rfq" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
  "dueDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RfqLineItem" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'EA',
  "notes" TEXT,
  "rfqId" TEXT NOT NULL,
  "takeoffItemId" TEXT,
  CONSTRAINT "RfqLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RfqRecipient" (
  "id" TEXT NOT NULL,
  "status" "RecipientStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "rfqId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  CONSTRAINT "RfqRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CostSettings" (
  "id" TEXT NOT NULL,
  "laborRate" DOUBLE PRECISION NOT NULL DEFAULT 95,
  "overheadPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
  "profitMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "difficultyMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "defaultCondition" "EstimateCondition" NOT NULL DEFAULT 'NORMAL',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "CostSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CostItem" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'EA',
  "laborHoursPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "materialCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source" "CostSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "lastUpdated" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "necaSourcePage" INTEGER,
  "necaSourceUnit" TEXT,
  "necaNormal" DOUBLE PRECISION,
  "necaDifficult" DOUBLE PRECISION,
  "necaVeryDifficult" DOUBLE PRECISION,
  "necaVerified" BOOLEAN NOT NULL DEFAULT false,
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CostEstimate" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
  "condition" "EstimateCondition" NOT NULL DEFAULT 'NORMAL',
  "laborRate" DOUBLE PRECISION NOT NULL,
  "overheadPercent" DOUBLE PRECISION NOT NULL,
  "profitMarginPercent" DOUBLE PRECISION NOT NULL,
  "difficultyMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "createdById" TEXT,
  CONSTRAINT "CostEstimate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EstimateLineItem" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'EA',
  "materialCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "laborHoursPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "laborNormal" DOUBLE PRECISION,
  "laborDifficult" DOUBLE PRECISION,
  "laborVeryDifficult" DOUBLE PRECISION,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "estimateId" TEXT NOT NULL,
  "costItemId" TEXT,
  CONSTRAINT "EstimateLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EstimateAdder" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AdderType" NOT NULL DEFAULT 'PERCENT',
  "appliesTo" "AdderBasis" NOT NULL DEFAULT 'DIRECT_COST',
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimateId" TEXT NOT NULL,
  CONSTRAINT "EstimateAdder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobCostEntry" (
  "id" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "actualLaborHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actualMaterialCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "costItemId" TEXT,
  "createdById" TEXT,
  CONSTRAINT "JobCostEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierQuote" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'EA',
  "unitMaterialCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT NOT NULL,
  "supplierId" TEXT,
  "projectId" TEXT,
  "costItemId" TEXT,
  "createdById" TEXT,
  CONSTRAINT "SupplierQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketFactor" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "direction" "MarketDirection" NOT NULL,
  "magnitude" DOUBLE PRECISION NOT NULL,
  "affects" "MarketAffects" NOT NULL,
  "source" TEXT,
  "url" TEXT,
  "asOf" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT NOT NULL,
  CONSTRAINT "MarketFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "userId" TEXT,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_organizationId_idx" ON "Invite"("organizationId");
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
CREATE UNIQUE INDEX "Rfi_projectId_number_key" ON "Rfi"("projectId", "number");
CREATE INDEX "Rfi_projectId_idx" ON "Rfi"("projectId");
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");
CREATE INDEX "TakeoffImport_projectId_idx" ON "TakeoffImport"("projectId");
CREATE INDEX "TakeoffItem_takeoffImportId_idx" ON "TakeoffItem"("takeoffImportId");
CREATE UNIQUE INDEX "Rfq_projectId_number_key" ON "Rfq"("projectId", "number");
CREATE INDEX "Rfq_projectId_idx" ON "Rfq"("projectId");
CREATE INDEX "RfqLineItem_rfqId_idx" ON "RfqLineItem"("rfqId");
CREATE UNIQUE INDEX "RfqRecipient_rfqId_supplierId_key" ON "RfqRecipient"("rfqId", "supplierId");
CREATE INDEX "RfqRecipient_rfqId_idx" ON "RfqRecipient"("rfqId");
CREATE UNIQUE INDEX "CostSettings_organizationId_key" ON "CostSettings"("organizationId");
CREATE INDEX "CostItem_organizationId_category_idx" ON "CostItem"("organizationId", "category");
CREATE INDEX "CostItem_organizationId_description_idx" ON "CostItem"("organizationId", "description");
CREATE UNIQUE INDEX "CostEstimate_organizationId_number_key" ON "CostEstimate"("organizationId", "number");
CREATE INDEX "CostEstimate_organizationId_status_idx" ON "CostEstimate"("organizationId", "status");
CREATE INDEX "CostEstimate_projectId_idx" ON "CostEstimate"("projectId");
CREATE INDEX "EstimateLineItem_estimateId_idx" ON "EstimateLineItem"("estimateId");
CREATE INDEX "EstimateAdder_estimateId_idx" ON "EstimateAdder"("estimateId");
CREATE INDEX "JobCostEntry_organizationId_date_idx" ON "JobCostEntry"("organizationId", "date");
CREATE INDEX "SupplierQuote_organizationId_quoteDate_idx" ON "SupplierQuote"("organizationId", "quoteDate");
CREATE INDEX "MarketFactor_organizationId_createdAt_idx" ON "MarketFactor"("organizationId", "createdAt");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffImport" ADD CONSTRAINT "TakeoffImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffImport" ADD CONSTRAINT "TakeoffImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TakeoffItem" ADD CONSTRAINT "TakeoffItem_takeoffImportId_fkey" FOREIGN KEY ("takeoffImportId") REFERENCES "TakeoffImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RfqLineItem" ADD CONSTRAINT "RfqLineItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RfqLineItem" ADD CONSTRAINT "RfqLineItem_takeoffItemId_fkey" FOREIGN KEY ("takeoffItemId") REFERENCES "TakeoffItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RfqRecipient" ADD CONSTRAINT "RfqRecipient_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RfqRecipient" ADD CONSTRAINT "RfqRecipient_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostSettings" ADD CONSTRAINT "CostSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostEstimate" ADD CONSTRAINT "CostEstimate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostEstimate" ADD CONSTRAINT "CostEstimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostEstimate" ADD CONSTRAINT "CostEstimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "CostEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EstimateAdder" ADD CONSTRAINT "EstimateAdder_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "CostEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCostEntry" ADD CONSTRAINT "JobCostEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCostEntry" ADD CONSTRAINT "JobCostEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCostEntry" ADD CONSTRAINT "JobCostEntry_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCostEntry" ADD CONSTRAINT "JobCostEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketFactor" ADD CONSTRAINT "MarketFactor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
