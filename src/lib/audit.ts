import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export async function logAction(params: {
  organizationId: string;
  accountId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  action: string;
  detail?: string;
}) {
  let accountId = params.accountId ?? null;
  if (!accountId) {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Account"
      WHERE "organizationId" = ${params.organizationId}
      ORDER BY CASE WHEN "slug" = 'main' THEN 0 ELSE 1 END, "createdAt" ASC
      LIMIT 1
    `;
    accountId = rows[0]?.id ?? null;
  }
  if (!accountId) throw new Error("Audit event requires an account/tenant context.");

  await db.$executeRaw`
    INSERT INTO "AuditLog" (
      "id", "action", "detail", "createdAt", "organizationId", "accountId", "projectId", "userId"
    ) VALUES (
      ${`audit_${randomUUID().replaceAll("-", "")}`},
      ${params.action},
      ${params.detail ?? null},
      CURRENT_TIMESTAMP,
      ${params.organizationId},
      ${accountId},
      ${params.projectId ?? null},
      ${params.userId ?? null}
    )
  `;
}
