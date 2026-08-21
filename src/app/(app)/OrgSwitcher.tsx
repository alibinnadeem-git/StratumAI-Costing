"use client";

import { useTransition } from "react";
import { switchOrgAction } from "./actions";

export default function OrgSwitcher({
  current,
  options,
}: {
  current: string;
  options: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="stratum-context-label">Organization</span>
      <select
        aria-label="Active organization"
        defaultValue={current}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("organizationId", e.target.value);
          startTransition(() => {
            switchOrgAction(fd);
          });
        }}
        className="stratum-context-select max-w-[220px] disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
