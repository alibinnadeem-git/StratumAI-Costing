"use client";

import { useTransition } from "react";
import { switchAccountAction } from "./actions";

export default function AccountSwitcher({
  current,
  options,
}: {
  current: string;
  options: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="stratum-context-label">Account / Tenant</span>
      <select
        value={current}
        disabled={pending}
        onChange={(event) => {
          const formData = new FormData();
          formData.set("accountId", event.target.value);
          startTransition(() => switchAccountAction(formData));
        }}
        className="min-w-[170px] border border-[#1C3A57] bg-[#0B1F32] px-2 py-1.5 font-mono text-[11px] text-[#DCEBF5] outline-none transition focus:border-[#C97C3D] disabled:opacity-50"
        aria-label="Active account or tenant"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </div>
  );
}
