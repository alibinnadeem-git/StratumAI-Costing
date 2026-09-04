"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Role, RfiPriority, RfiStatus, RecipientStatus, RfqStatus } from "@prisma/client";
import RFIBoard from "./RFIBoard";
import RfqBoard from "./RfqBoard";

type Rfi = {
  id: string; number: number; sheet: string | null; location: string | null;
  subject: string; question: string; response: string | null; status: RfiStatus;
  priority: RfiPriority; imageDataUrl: string | null; submittedBy: string | null;
  dateSubmitted: string | null; dateNeeded: string | null; dateAnswered: string | null;
  createdBy: { name: string | null; email: string } | null;
};
type TakeoffItem = { id: string; subject: string; count: number | null; length: string | null; area: string | null; description: string | null; unit: string | null };
type TakeoffImport = { id: string; fileName: string | null; importedAt: string; items: TakeoffItem[] };
type Supplier = { id: string; name: string; contactName: string | null; email: string; phone: string | null; categories: string[] };
type RfqRecipient = { id: string; status: RecipientStatus; sentAt: string | null; supplier: Supplier };
type RfqLineItem = { id: string; description: string; quantity: number; unit: string; notes: string | null };
type Rfq = { id: string; number: number; title: string; status: RfqStatus; dueDate: string | null; notes: string | null; lineItems: RfqLineItem[]; recipients: RfqRecipient[] };

export default function ProjectTabs({ project, role, initialRfis, initialTakeoffImports, initialRfqs, suppliers }: { project: { id: string; name: string; number: string | null }; role: Role; initialRfis: Rfi[]; initialTakeoffImports: TakeoffImport[]; initialRfqs: Rfq[]; suppliers: Supplier[] }) {
  const [tab, setTab] = useState<"rfi" | "rfq">("rfi");
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-lg font-semibold text-slate-800">{project.name}</h1><p className="text-xs text-slate-400">{project.number ? `Project #${project.number}` : "Project"}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-md border border-slate-200 bg-white p-0.5">{(["rfi","rfq"] as const).map((t)=><button key={t} onClick={()=>setTab(t)} className={`rounded px-3 py-1.5 text-xs font-semibold transition ${tab===t?"bg-slate-900 text-white":"text-slate-500 hover:text-slate-800"}`}>{t==="rfi"?"RFIs":"Takeoff & RFQs"}</button>)}</div><Link href={`/projects/${project.id}/drawings`} className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">Drawings</Link><Link href={`/projects/${project.id}/drawings/viewer`} className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">Spatial Viewer</Link><Link href={`/projects/${project.id}/plan-room`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Plan Room</Link><Link href={`/projects/${project.id}/commercial/rfi-impact`} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">RFI Impact</Link><Link href={`/projects/${project.id}/commercial`} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Commercial Risk</Link><Link href={`/costing/estimates/new?projectId=${project.id}`} className="rounded-md border border-signal-200 bg-signal-50 px-3 py-1.5 text-xs font-semibold text-signal-700">Cost this project</Link></div></div>
    {tab === "rfi" && initialRfis.length > 0 && <details className="border border-[#1C3A57] bg-[#0B1F32] p-3"><summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] text-[#6FD6C9]">RFI creator trace</summary><div className="mt-3 grid gap-2 md:grid-cols-2">{initialRfis.map((r)=><div key={r.id} className="flex items-center justify-between gap-3 border border-[#1C3A57] px-3 py-2 text-xs"><span className="font-mono text-[#E0954F]">RFI-{String(r.number).padStart(3,"0")}</span><span className="min-w-0 truncate text-right text-[#DCEBF5]">{r.createdBy?.name || r.createdBy?.email || r.submittedBy || "Unknown creator"}</span></div>)}</div></details>}
    {tab === "rfi" ? <RFIBoard project={project} role={role} initialRfis={initialRfis} hideHeader /> : <RfqBoard project={project} role={role} initialTakeoffImports={initialTakeoffImports} initialRfqs={initialRfqs} suppliers={suppliers} />}
  </div>;
}
