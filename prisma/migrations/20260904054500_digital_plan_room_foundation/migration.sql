-- Digital Plan Room foundation (PRD I01-I05).
-- Additive metadata model; binary/object storage remains provider-neutral.

CREATE TABLE IF NOT EXISTS "ProjectDocumentFolder" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectDocumentFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocumentFolder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectDocumentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocumentFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ProjectDocumentFolder_projectId_idx" ON "ProjectDocumentFolder"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectDocumentFolder_accountId_idx" ON "ProjectDocumentFolder"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDocumentFolder_project_parent_name_key" ON "ProjectDocumentFolder"("projectId", COALESCE("parentId", ''), "name");

CREATE TABLE IF NOT EXISTS "ProjectDocument" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "folderId" TEXT,
  "name" TEXT NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" TEXT NOT NULL DEFAULT 'CURRENT',
  "storageProvider" TEXT NOT NULL DEFAULT 'EXTERNAL',
  "storageKey" TEXT,
  "externalUrl" TEXT,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "description" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ProjectDocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectDocument_accountId_idx" ON "ProjectDocument"("accountId");
CREATE INDEX IF NOT EXISTS "ProjectDocument_folderId_idx" ON "ProjectDocument"("folderId");
CREATE INDEX IF NOT EXISTS "ProjectDocument_documentType_idx" ON "ProjectDocument"("documentType");

CREATE TABLE IF NOT EXISTS "ProjectDocumentRevision" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL DEFAULT 'EXTERNAL',
  "storageKey" TEXT,
  "externalUrl" TEXT,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "changeSummary" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectDocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocumentRevision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocumentRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDocumentRevision_document_revision_key" ON "ProjectDocumentRevision"("documentId", "revision");
CREATE INDEX IF NOT EXISTS "ProjectDocumentRevision_accountId_idx" ON "ProjectDocumentRevision"("accountId");

CREATE TABLE IF NOT EXISTS "ProjectDocumentAssociation" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectDocumentAssociation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocumentAssociation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDocumentAssociation_document_entity_key" ON "ProjectDocumentAssociation"("documentId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ProjectDocumentAssociation_entity_idx" ON "ProjectDocumentAssociation"("accountId", "entityType", "entityId");
