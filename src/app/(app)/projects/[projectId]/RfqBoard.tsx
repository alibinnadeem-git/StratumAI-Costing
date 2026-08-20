"use client";

import React, { useMemo, useRef, useState } from "react";
import type { Role, RecipientStatus, RfqStatus } from "@prisma/client";
import { atLeast } from "@/lib/rbac";
import { importTakeoffAction, updateTakeoffItemAction, createRfqAction, deleteRfqAction } from "./rfq-actions";

type TakeoffItem = { id: string; subject: string; count: number | null; length: string | null; area: string | null; description: string | null; unit: string | null };
type TakeoffImport = { id: string; fileName: string | null; importedAt: string; items: TakeoffItem[] };
type Supplier = { id: string; name: string; contactName: string | null; email: string; phone: string | null; categories: string[] };
type RfqRecipient = { id: string; status: RecipientStatus; sentAt: string | null; supplier: Supplier };
type RfqLineItem = { id: string; description: string; quantity: number; unit: string; notes: string | null };
type Rfq = { id: string; number: number; title: string; status: RfqStatus; dueDate: string | null; notes: string | null; lineItems: RfqLineItem[]; recipients: RfqRecipient[] };

const inputCls = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-500";
const RFQ_STATUS_META: Record<RfqStatus, { label: string; pill: string }> = {
  DRAFT: { label: "Draft", pill: "bg-slate-100 text-slate-600 border-slate-200" },
  SENT: { label: "Sent", pill: "bg-sky-50 text-sky-700 border-sky-200" },
  CLOSED: { label: "Closed", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const RECIPIENT_META: Record<RecipientStatus, string> = {
  PENDING: "text-slate-400", SENT: "text-emerald-600", FAILED: "text-rose-600", RESPONDED: "text-blue-600",
};

function pad(n: number) { return `RFQ-${String(n).padStart(3, "0")}`; }
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }

export default function RfqBoard({
  project, role, initialTakeoffImports, initialRfqs, suppliers,
}: {
  project: { id: string; name: string; number: string | null };
  role: Role;
  initialTakeoffImports: TakeoffImport[];
  initialRfqs: Rfq[];
  suppliers: Supplier[];
}) {
  const [imports, setImports] = useState(initialTakeoffImports);
  const [rfqs, setRfqs] = useState(initialRfqs);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeRfqId, setActiveRfqId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const canImport = atLeast(role, "MEMBER");
  const canCreateRfq = atLeast(role, "MEMBER");
  const canDeleteRfq = atLeast(role, "ADMIN");

  const allItems = useMemo(() => imports.flatMap((i) => i.items.map((it) => ({ ...it, importId: i.id }))), [imports]);
  const activeRfq = rfqs.find((r) => r.id === activeRfqId) || null;

  async function refreshTakeoff() {
    const res = await fetch(`/api/projects/${project.id}/takeoff`, { cache: "no-store" });
    if (res.ok) setImports(await res.json());
  }
  async function refreshRfqs() {
    const res = await fetch(`/api/projects/${project.id}/rfqs`, { cache: "no-store" });
    if (res.ok) setRfqs(await res.json());
  }

  async function handleImport(file?: File | null) {
    if (!file) return;
    setImporting(true); setImportError("");
    try {
      const text = await file.text();
      await importTakeoffAction(project.id, file.name, text);
      await refreshTakeoff();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function saveItemField(itemId: string, patch: { description?: string; unit?: string }) {
    await updateTakeoffItemAction(project.id, itemId, patch);
  }

  return (
    <div className="space-y-8">
      {/* Takeoff import */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Bluebeam takeoff import</h2>
          {canImport && (
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleImport(e.target.files?.[0])} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              >
                {importing ? "Importing…" : "+ Import Markups List CSV"}
              </button>
            </div>
          )}
        </div>
        {importError && <p className="text-xs font-medium text-rose-600">{importError}</p>}
        <p className="text-xs text-slate-400">
          In Bluebeam: Markups List panel &rarr; export icon &rarr; CSV. Import it here, review/edit the description
          each line will show a supplier, then select rows below to build an RFQ.
        </p>

        {allItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-400">
            No takeoff imported yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-8 px-4 py-2.5" />
                  <th className="px-2 py-2.5 font-semibold">Bluebeam subject</th>
                  <th className="px-2 py-2.5 font-semibold">Supplier description</th>
                  <th className="px-2 py-2.5 font-semibold">Count</th>
                  <th className="px-2 py-2.5 font-semibold">Unit</th>
                  <th className="px-2 py-2.5 font-semibold">Length</th>
                  <th className="px-2 py-2.5 font-semibold">Area</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelected(it.id)} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500">{it.subject}</td>
                    <td className="px-2 py-2">
                      <input
                        defaultValue={it.description ?? it.subject}
                        onBlur={(e) => saveItemField(it.id, { description: e.target.value })}
                        className="w-56 rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-600">{it.count ?? "—"}</td>
                    <td className="px-2 py-2">
                      <input
                        defaultValue={it.unit ?? "EA"}
                        onBlur={(e) => saveItemField(it.id, { unit: e.target.value })}
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500">{it.length ?? "—"}</td>
                    <td className="px-2 py-2 text-xs text-slate-500">{it.area ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected.size > 0 && canCreateRfq && (
          <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5">
            <span className="text-xs font-semibold text-blue-800">{selected.size} item{selected.size === 1 ? "" : "s"} selected</span>
            <button onClick={() => setShowBuilder(true)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              Build RFQ from selection &rarr;
            </button>
          </div>
        )}
      </section>

      {/* RFQ list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">RFQs</h2>
          {canCreateRfq && (
            <button onClick={() => setShowBuilder(true)} className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98]">
              + New RFQ
            </button>
          )}
        </div>

        {rfqs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-400">
            No RFQs yet. Select takeoff items above and build one.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">RFQ #</th>
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-4 py-2.5 font-semibold">Suppliers</th>
                  <th className="px-4 py-2.5 font-semibold">Due</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => (
                  <tr key={r.id} onClick={() => setActiveRfqId(r.id)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-500">{pad(r.number)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.title}</div>
                      <div className="text-xs text-slate-400">{r.lineItems.length} line item{r.lineItems.length === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.recipients.map((rc) => rc.supplier.name).join(", ")}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmt(r.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${RFQ_STATUS_META[r.status].pill}`}>{RFQ_STATUS_META[r.status].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showBuilder && (
        <RfqBuilderModal
          projectId={project.id}
          takeoffItems={allItems.filter((it) => selected.has(it.id))}
          suppliers={suppliers}
          onClose={() => setShowBuilder(false)}
          onCreated={async () => { await refreshRfqs(); setSelected(new Set()); setShowBuilder(false); }}
        />
      )}
      {activeRfq && (
        <RfqDetailDrawer
          rfq={activeRfq} projectId={project.id} canDelete={canDeleteRfq}
          onClose={() => setActiveRfqId(null)} onChanged={refreshRfqs}
        />
      )}
    </div>
  );
}

function RfqBuilderModal({
  projectId, takeoffItems, suppliers, onClose, onCreated,
}: {
  projectId: string;
  takeoffItems: (TakeoffItem & { importId: string })[];
  suppliers: Supplier[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("Material RFQ");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [supplierIds, setSupplierIds] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState(
    takeoffItems.map((it) => ({
      description: it.description || it.subject,
      quantity: it.count ?? 1,
      unit: it.unit || "EA",
      takeoffItemId: it.id,
    }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleSupplier(id: string) {
    setSupplierIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function updateLine(i: number, patch: Partial<(typeof lines)[number]>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (supplierIds.size === 0) { setError("Select at least one supplier."); return; }
    setBusy(true);
    try {
      await createRfqAction(projectId, {
        title, dueDate, notes, supplierIds: Array.from(supplierIds),
        lineItems: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit: l.unit, takeoffItemId: l.takeoffItemId })),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create RFQ.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-8">
      <form onSubmit={submit} className="w-full max-w-2xl animate-scale-in rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold text-slate-800">Build RFQ</div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="Title"><input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></F>
            <F label="Quote due"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></F>
          </div>
          <F label="Notes to suppliers (optional)">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Lead time requirements, delivery address, spec references…" />
          </F>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Send to</div>
            <div className="flex flex-wrap gap-2">
              {suppliers.length === 0 && <p className="text-xs text-slate-400">No suppliers yet — add one on the Suppliers page first.</p>}
              {suppliers.map((s) => (
                <button
                  key={s.id} type="button" onClick={() => toggleSupplier(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${supplierIds.has(s.id) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Line items ({lines.length})</div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} className={`${inputCls} flex-1`} />
                  <input type="number" min={0} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className={`${inputCls} w-20`} />
                  <input value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} className={`${inputCls} w-16`} />
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">Cancel</button>
          <button disabled={busy} type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98] disabled:opacity-50">{busy ? "Creating…" : "Create RFQ"}</button>
        </div>
      </form>
    </div>
  );
}

function RfqDetailDrawer({
  rfq, projectId, canDelete, onClose, onChanged,
}: { rfq: Rfq; projectId: string; canDelete: boolean; onClose: () => void; onChanged: () => void }) {
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");

  async function send() {
    setSending(true); setSendMsg("");
    try {
      const res = await fetch(`/api/rfqs/${rfq.id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");
      setSendMsg(`Sent to ${json.sent} supplier${json.sent === 1 ? "" : "s"}${json.failed ? `, ${json.failed} failed` : ""}.`);
      onChanged();
    } catch (err) {
      setSendMsg(err instanceof Error ? err.message : "Send failed.");
    } finally { setSending(false); }
  }

  const pendingCount = rfq.recipients.filter((r) => r.status !== "SENT").length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50">
      <div className="h-full w-full max-w-xl animate-slide-in-right overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="font-mono text-xs font-semibold text-blue-600">{pad(rfq.number)}</div>
            <div className="text-base font-semibold text-slate-800">{rfq.title}</div>
            <div className="mt-1 text-xs text-slate-400">Due {fmt(rfq.dueDate)}</div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex gap-2">
            <a href={`/api/rfqs/${rfq.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50">
              Download PDF
            </a>
            {pendingCount > 0 && (
              <button onClick={send} disabled={sending} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {sending ? "Sending…" : `Send to ${pendingCount} supplier${pendingCount === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
          {sendMsg && <p className="text-xs font-medium text-slate-600">{sendMsg}</p>}

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recipients</div>
            <div className="space-y-1.5">
              {rfq.recipients.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-slate-700">{r.supplier.name}</div>
                    <div className="text-xs text-slate-400">{r.supplier.email}</div>
                  </div>
                  <span className={`text-xs font-semibold ${RECIPIENT_META[r.status]}`}>{r.status}{r.sentAt ? ` · ${fmt(r.sentAt)}` : ""}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Line items</div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-xs">
                <tbody>
                  {rfq.lineItems.map((li) => (
                    <tr key={li.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{li.description}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{li.quantity} {li.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {rfq.notes && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes</div>
              <p className="text-sm text-slate-600">{rfq.notes}</p>
            </div>
          )}

          {canDelete && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={async () => { if (confirm(`Delete ${pad(rfq.number)}?`)) { await deleteRfqAction(projectId, rfq.id); onChanged(); onClose(); } }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Delete RFQ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
