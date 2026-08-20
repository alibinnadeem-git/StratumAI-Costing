"use client";

import { useTransition } from "react";
import { switchOrgAction } from "./actions";

export default function OrgSwitcher({
  current, options,
}: { current: string; options: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("organizationId", e.target.value);
        startTransition(() => { switchOrgAction(fd); });
      }}
      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}
