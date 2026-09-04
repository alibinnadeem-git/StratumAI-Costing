-- PRD commercial-intelligence expansion: additive only.
-- Keeps existing RFI/RFQ/SupplierQuote models intact while adding explicit
-- commercial exposure, lead-time, and provenance relationships.

CREATE TABLE IF NOT EXISTS "RfiCommercialImpact" (
  "id" TEXT PRIMARY KEY,
  "rfiId" TEXT NOT NULL UNIQUE,
  "accountId" TEXT NOT NULL,
  "classification" TEXT NOT NULL DEFAULT 'POTENTIAL',
  "costImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "scheduleDays" INTEGER NOT NULL DEFAULT 0,
  "laborHoursImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfiCommercialImpact_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "Rfi"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RfiCommercialImpact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RfiCommercialImpact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RfiCommercialImpact_accountId_idx" ON "RfiCommercialImpact"("accountId");
CREATE INDEX IF NOT EXISTS "RfiCommercialImpact_classification_idx" ON "RfiCommercialImpact"("classification");

CREATE TABLE IF NOT EXISTS "SupplierLeadTime" (
  "id" TEXT PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "leadTimeDays" INTEGER NOT NULL,
  "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "source" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierLeadTime_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierLeadTime_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierLeadTime_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierLeadTime_supplier_category_key" ON "SupplierLeadTime"("supplierId", "category");
CREATE INDEX IF NOT EXISTS "SupplierLeadTime_accountId_idx" ON "SupplierLeadTime"("accountId");

CREATE TABLE IF NOT EXISTS "RfqEstimateLink" (
  "id" TEXT PRIMARY KEY,
  "rfqId" TEXT NOT NULL UNIQUE,
  "estimateId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqEstimateLink_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RfqEstimateLink_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "CostEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RfqEstimateLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RfqEstimateLink_estimateId_idx" ON "RfqEstimateLink"("estimateId");
CREATE INDEX IF NOT EXISTS "RfqEstimateLink_accountId_idx" ON "RfqEstimateLink"("accountId");

CREATE TABLE IF NOT EXISTS "RfqLineEstimateLink" (
  "id" TEXT PRIMARY KEY,
  "rfqLineItemId" TEXT NOT NULL UNIQUE,
  "estimateLineItemId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqLineEstimateLink_rfqLineItemId_fkey" FOREIGN KEY ("rfqLineItemId") REFERENCES "RfqLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RfqLineEstimateLink_estimateLineItemId_fkey" FOREIGN KEY ("estimateLineItemId") REFERENCES "EstimateLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RfqLineEstimateLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RfqLineEstimateLink_estimateLineItemId_idx" ON "RfqLineEstimateLink"("estimateLineItemId");
CREATE INDEX IF NOT EXISTS "RfqLineEstimateLink_accountId_idx" ON "RfqLineEstimateLink"("accountId");

CREATE TABLE IF NOT EXISTS "SupplierQuoteRfqLink" (
  "id" TEXT PRIMARY KEY,
  "quoteId" TEXT NOT NULL UNIQUE,
  "rfqId" TEXT NOT NULL,
  "supplierId" TEXT,
  "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierQuoteRfqLink_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "SupplierQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierQuoteRfqLink_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierQuoteRfqLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SupplierQuoteRfqLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SupplierQuoteRfqLink_rfqId_idx" ON "SupplierQuoteRfqLink"("rfqId");
CREATE INDEX IF NOT EXISTS "SupplierQuoteRfqLink_accountId_idx" ON "SupplierQuoteRfqLink"("accountId");
