"use client";

import { useTransition } from "react";
import type { Role } from "@prisma/client";
import { updateMemberRoleAction } from "./actions";

export default function RoleSelect({
  membershipId, currentRole, canGrantOwner,
}: { membershipId: string; currentRole: Role; canGrantOwner: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentRole}
      disabled={pending}
      onChange={(e) => startTransition(() => { updateMemberRoleAction(membershipId, e.target.value as Role); })}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
    >
      <option value="VIEWER">Viewer</option>
      <option value="MEMBER">Member</option>
      <option value="ADMIN">Admin</option>
      {canGrantOwner && <option value="OWNER">Owner</option>}
    </select>
  );
}
