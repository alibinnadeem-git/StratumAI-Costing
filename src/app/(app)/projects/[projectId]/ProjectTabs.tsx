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
    <div className="flex items-center justify-between"><div><h1 className="text-lg font-semibold text-slate-800">{project.name}</h1><p className="text-xs text-slate-400">{project.number ? `Project #${project.number}` : "Project"}</p></div><div className="flex items-center gap-2"><div className="flex rounded-md border border-slate-200 bg-white p-0.5">{(["rfi","rfq"] as const).map((t)=><button key={t} onClick={()=>setTab(t)} className={`rounded px-3 py-1.5 text-xs font-semibold transition ${tab===t?"bg-slate-900 text-white":"text-slate-500 hover:text-slate-800"}`}>{t==="rfi"?"RFIs":"Takeoff & RFQs"}</button>)}</div><Link href={`/costing/estimates/new?projectId=${project.id}`} className="rounded-md border border-signal-200 bg-signal-50 px-3 py-1.5 text-xs font-semibold text-signal-700">Cost this project</Link></div></div>
    {tab === "rfi" ? <RFIBoard project={project} role={role} initialRfis={initialRfis} hideHeader /> : <RfqBoard project={project} role={role} initialTakeoffImports={initialTakeoffImports} initialRfqs={initialRfqs} suppliers={suppliers} />}
  </div>;
}
