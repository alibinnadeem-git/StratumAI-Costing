CREATE TABLE IF NOT EXISTS "EstimateRevisionLink" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
  "parentEstimateId" text NOT NULL REFERENCES "CostEstimate"("id") ON DELETE RESTRICT,
  "childEstimateId" text NOT NULL UNIQUE REFERENCES "CostEstimate"("id") ON DELETE CASCADE,
  "createdById" text REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EstimateRevisionLink_account_parent_idx"
  ON "EstimateRevisionLink" ("accountId", "parentEstimateId");
