import { db } from "@/lib/db";

export async function logAction(params: {
  organizationId: string;
  userId?: string | null;
  projectId?: string | null;
  action: string;
  detail?: string;
}) {
  await db.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId ?? null,
      projectId: params.projectId ?? null,
      action: params.action,
      detail: params.detail,
    },
  });
}
