ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

UPDATE "Invite" i
SET "accountId" = a."id"
FROM "Account" a
WHERE i."accountId" IS NULL
  AND a."organizationId" = i."organizationId"
  AND a."slug" = 'main';

CREATE INDEX IF NOT EXISTS "Invite_accountId_idx" ON "Invite"("accountId");
