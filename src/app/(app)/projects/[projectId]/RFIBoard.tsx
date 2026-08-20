"use client";

import React, { useMemo, useRef, useState } from "react";
import type { Role, RfiPriority, RfiStatus } from "@prisma/client";
import { atLeast } from "@/lib/rbac";
import { createRfiAction, updateRfiStatusAction, deleteRfiAction } from "./rfi-actions";

type Rfi = {
  id: string; number: number; sheet: string | null; location: string | null;
  subject: string; question: string; response: string | null; status: RfiStatus;
  priority: RfiPriority; imageDataUrl: string | null; submittedBy: string | null;
  dateSubmitted: string | null; dateNeeded: string | null; dateAnswered: string | null;
};

const STATUS_META: Record<RfiStatus, { label: string; dot: string; pill: string }> = {
  OPEN: { label: "Open", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800 border-amber-200" },
  ANSWERED: { label: "Answered", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  CLOSED: { label: "Closed", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 border-slate-200" },
};
const PRIORITY_META: Record<RfiPriority, { label: string; pill: string }> = {
  LOW: { label: "Low", pill: "bg-slate-100 text-slate-600" },
  NORMAL: { label: "Normal", pill: "bg-sky-50 text-sky-700" },
  HIGH: { label: "High", pill: "bg-rose-50 text-rose-700" },
};
const inputCls = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-500";
const MAX_IMG_DIM = 1600;

function pad(n: number) { return `RFI-${String(n).padStart(3, "0")}`; }
function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

function resizeImage(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale); height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function RFIBoard({
  project, role, initialRfis, hideHeader = false,
}: { project: { id: string; name: string; number: string | null }; role: Role; initialRfis: Rfi[]; hideHeader?: boolean }) {
  const [rfis, setRfis] = useState(initialRfis);
  const [showForm, setShowForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | RfiStatus>("all");
  const [query, setQuery] = useState("");
  const [showEmail, setShowEmail] = useState(false);

  const canCreate = atLeast(role, "MEMBER");
  const canDelete = atLeast(role, "ADMIN");

  const filtered = useMemo(() => {
    return rfis
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter((r) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return r.subject.toLowerCase().includes(q) || r.question.toLowerCase().includes(q) ||
          (r.location || "").toLowerCase().includes(q) || (r.sheet || "").toLowerCase().includes(q) ||
          pad(r.number).toLowerCase().includes(q);
      });
  }, [rfis, filter, query]);

  const counts = {
    all: rfis.length,
    OPEN: rfis.filter((r) => r.status === "OPEN").length,
    ANSWERED: rfis.filter((r) => r.status === "ANSWERED").length,
    CLOSED: rfis.filter((r) => r.status === "CLOSED").length,
  };
  const active = rfis.find((r) => r.id === activeId) || null;

  async function refreshOne() {
    // Server actions already revalidate the path; a soft refresh keeps the
    // client array in sync without a full reload.
    const res = await fetch(`/api/projects/${project.id}/rfis`, { cache: "no-store" });
    if (res.ok) setRfis(await res.json());
  }

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap items-start gap-3 ${hideHeader ? "justify-end" : "justify-between"}`}>
        {!hideHeader && (
          <div>
            <h1 className="text-lg font-semibold text-slate-800">{project.name}</h1>
            <p className="text-xs text-slate-400">{project.number ? `Project #${project.number}` : "RFI Log"}</p>
          </div>
        )}
        <div className="flex gap-2">
          <a
            href={`/api/projects/${project.id}/rfi-log/pdf`}
            target="_blank" rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Download PDF
          </a>
          <button
            onClick={() => setShowEmail(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Email log
          </button>
          {canCreate && (
            <button onClick={() => setShowForm(true)} className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98]">
              + Log RFI
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "OPEN", "ANSWERED", "CLOSED"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${filter === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"}`}
            >
              {key === "all" ? "All" : STATUS_META[key].label} <span className="opacity-60">({counts[key]})</span>
            </button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search RFIs…" className={`${inputCls} w-48`} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-400">
          {rfis.length === 0 ? "No RFIs logged yet." : "Nothing matches this filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-semibold">RFI #</th>
                <th className="px-4 py-2.5 font-semibold">Sheet</th>
                <th className="px-4 py-2.5 font-semibold">Subject</th>
                <th className="px-4 py-2.5 font-semibold">Priority</th>
                <th className="px-4 py-2.5 font-semibold">Submitted</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setActiveId(r.id)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-500">{pad(r.number)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{r.sheet || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{r.subject}</div>
                    <div className="max-w-md truncate text-xs text-slate-400">{r.question}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_META[r.priority].pill}`}>{PRIORITY_META[r.priority].label}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmt(r.dateSubmitted)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_META[r.status].pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[r.status].dot}`} />{STATUS_META[r.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <NewRfiModal projectId={project.id} onClose={() => setShowForm(false)} onCreated={refreshOne} />}
      {active && (
        <DetailDrawer
          rfi={active} projectId={project.id} canDelete={canDelete}
          onClose={() => setActiveId(null)} onChanged={refreshOne}
        />
      )}
      {showEmail && <EmailModal projectId={project.id} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function NewRfiModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [sheet, setSheet] = useState(""); const [location, setLocation] = useState("");
  const [subject, setSubject] = useState(""); const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState<RfiPriority>("NORMAL");
  const [dateSubmitted, setDateSubmitted] = useState(todayISO()); const [dateNeeded, setDateNeeded] = useState("");
  const [submittedBy, setSubmittedBy] = useState(""); const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [imgBusy, setImgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file?: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    setImgBusy(true);
    try { setImage(await resizeImage(file, MAX_IMG_DIM)); } finally { setImgBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !question.trim()) return;
    setBusy(true);
    try {
      await createRfiAction(projectId, { sheet, location, subject, question, priority, dateSubmitted, dateNeeded, submittedBy, imageDataUrl: image });
      onCreated(); onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-8">
      <form onSubmit={submit} className="w-full max-w-2xl animate-scale-in rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold text-slate-800">Log new RFI</div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            className="relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-blue-400"
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            {image ? <img src={image} alt="Markup" className="max-h-56 rounded border border-slate-200 object-contain" /> : (
              <div className="text-xs font-semibold text-slate-600">{imgBusy ? "Processing…" : "Drop Bluebeam screenshot or click to browse"}</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sheet / Drawing #"><input value={sheet} onChange={(e) => setSheet(e.target.value)} className={inputCls} /></Field>
            <Field label="Location / Area"><input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Subject"><input required value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} /></Field>
          <Field label="Question"><textarea required rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as RfiPriority)} className={inputCls}>
                <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option>
              </select>
            </Field>
            <Field label="Submitted"><input type="date" value={dateSubmitted} onChange={(e) => setDateSubmitted(e.target.value)} className={inputCls} /></Field>
            <Field label="Needed by"><input type="date" value={dateNeeded} onChange={(e) => setDateNeeded(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Submitted by"><input value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">Cancel</button>
          <button disabled={busy} type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98] disabled:opacity-50">{busy ? "Saving…" : "Log RFI"}</button>
        </div>
      </form>
    </div>
  );
}

function DetailDrawer({ rfi, projectId, canDelete, onClose, onChanged }: {
  rfi: Rfi; projectId: string; canDelete: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [status, setStatus] = useState(rfi.status);
  const [response, setResponse] = useState(rfi.response || "");
  const [busy, setBusy] = useState(false);

  async function save(nextStatus: RfiStatus) {
    setBusy(true);
    try { await updateRfiStatusAction(projectId, rfi.id, nextStatus, response); setStatus(nextStatus); onChanged(); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50">
      <div className="h-full w-full max-w-xl animate-slide-in-right overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="font-mono text-xs font-semibold text-blue-600">{pad(rfi.number)}</div>
            <div className="text-base font-semibold text-slate-800">{rfi.subject}</div>
            <div className="mt-1 text-xs text-slate-400">{rfi.sheet || "—"} · {rfi.location || "—"}</div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="space-y-5 px-5 py-5">
          {rfi.imageDataUrl && <img src={rfi.imageDataUrl} alt="Markup" className="w-full rounded-md border border-slate-200" />}
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Question</div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{rfi.question}</p>
          </div>
          <Field label="Status">
            <select value={status} onChange={(e) => save(e.target.value as RfiStatus)} disabled={busy} className={inputCls}>
              <option value="OPEN">Open</option><option value="ANSWERED">Answered</option><option value="CLOSED">Closed</option>
            </select>
          </Field>
          <Field label="Response">
            <textarea rows={4} value={response} onChange={(e) => setResponse(e.target.value)} onBlur={() => save(status)} className={inputCls} placeholder="Log the answer once received…" />
          </Field>
          {canDelete && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={async () => { if (confirm(`Delete ${pad(rfi.number)}?`)) { await deleteRfiAction(projectId, rfi.id); onChanged(); onClose(); } }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Delete RFI
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [emails, setEmails] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/rfi-log/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emails.split(",").map((s) => s.trim()).filter(Boolean), note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to send");
      setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to send"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={send} className="w-full max-w-md animate-scale-in rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 text-sm font-semibold text-slate-800">Email RFI log</div>
        {sent ? (
          <p className="text-sm text-emerald-600">Sent. The PDF log is on its way.</p>
        ) : (
          <div className="space-y-3">
            <Field label="Recipients (comma separated)">
              <input required value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="pm@client.com, engineer@firm.com" className={inputCls} />
            </Field>
            <Field label="Note (optional)">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
            </Field>
            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">{sent ? "Close" : "Cancel"}</button>
          {!sent && <button disabled={busy} type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-glow active:scale-[0.98] disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
