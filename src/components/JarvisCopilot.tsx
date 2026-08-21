"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, ChevronDown, Loader2, Send, Sparkles, X } from "lucide-react";

type Message = { role: "user" | "assistant"; text: string };

export default function JarvisCopilot({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Jarvis online for ${organizationName}. Ask me how to use this screen, explain an estimating workflow, or guide you through Projects, RFIs, RFQs, suppliers, job costs, RBAC and commercial intelligence.`,
    },
  ]);

  const pathname = useMemo(() => (typeof window !== "undefined" ? window.location.pathname : ""), [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;

    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", text: message }]);

    try {
      const response = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, pathname, organizationId }),
      });
      const data = await response.json().catch(() => ({}));
      const answer = response.ok ? String(data.answer ?? "Jarvis could not produce an answer.") : String(data.error ?? "Jarvis is unavailable.");
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Jarvis could not reach its guidance service. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-14 right-4 z-[70] sm:right-6">
      {open && (
        <section className="mb-3 flex h-[min(620px,70vh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden border border-[#C97C3D] bg-[#0E2438] shadow-2xl">
          <header className="flex items-center justify-between border-b border-[#1C3A57] bg-[#0B1F32] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center border border-[#6FD6C9] text-[#6FD6C9]"><Bot className="h-4 w-4" /></span>
              <div>
                <div className="font-semibold uppercase tracking-[0.05em] text-[#DCEBF5]">Jarvis</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#6D8AA0]">Stratum AI Copilot · Tenant Aware</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-[#9FB6C7] hover:text-white" aria-label="Close Jarvis"><X className="h-4 w-4" /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "ml-8" : "mr-5"}>
                <div className={message.role === "user" ? "border border-[#C97C3D] bg-[#C97C3D]/10 p-3 text-sm text-[#F1D6BF]" : "border border-[#1C3A57] bg-[#0A1A2B]/60 p-3 text-sm leading-6 text-[#DCEBF5]"}>
                  {message.text}
                </div>
              </div>
            ))}
            {busy && <div className="mr-5 flex items-center gap-2 border border-[#1C3A57] bg-[#0A1A2B]/60 p-3 font-mono text-[11px] text-[#6FD6C9]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking within your workspace…</div>}
          </div>

          <div className="border-t border-[#1C3A57] p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["Explain this screen", "Check estimate workflow", "How do RFQs work?"].map((prompt) => (
                <button key={prompt} type="button" onClick={() => setInput(prompt)} className="border border-[#1C3A57] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.04em] text-[#9FB6C7] hover:border-[#6FD6C9] hover:text-[#6FD6C9]">{prompt}</button>
              ))}
            </div>
            <form onSubmit={submit} className="flex gap-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} maxLength={4000} placeholder="Ask Jarvis for guidance…" className="min-h-[54px] flex-1 resize-none border border-[#1C3A57] bg-[#0A1A2B] px-3 py-2 text-sm text-[#DCEBF5] outline-none placeholder:text-[#6D8AA0] focus:border-[#C97C3D]" />
              <button disabled={busy || !input.trim()} className="flex w-11 items-center justify-center border border-[#C97C3D] text-[#E0954F] hover:bg-[#C97C3D] hover:text-[#0A1A2B] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send to Jarvis"><Send className="h-4 w-4" /></button>
            </form>
            <p className="mt-2 font-mono text-[9px] leading-4 text-[#6D8AA0]">GUIDANCE MODE · Writes, sends and destructive actions require normal RBAC and explicit approval.</p>
          </div>
        </section>
      )}

      <button onClick={() => setOpen((value) => !value)} className="group flex items-center gap-2 border border-[#C97C3D] bg-[#0B1F32] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#E0954F] shadow-xl transition hover:bg-[#C97C3D] hover:text-[#0A1A2B]">
        {open ? <ChevronDown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        Jarvis
      </button>
    </div>
  );
}
