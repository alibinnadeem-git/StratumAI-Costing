"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, ChevronDown, Database, Globe2, Loader2, Send, Sparkles, X } from "lucide-react";

type Message = { role: "user" | "assistant"; text: string };

type JarvisCopilotProps = {
  organizationId: string;
  organizationName: string;
  accountId: string;
  accountName: string;
};

export default function JarvisCopilot({
  organizationId,
  organizationName,
  accountId,
  accountName,
}: JarvisCopilotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Jarvis online for ${organizationName} · ${accountName}. Ask what to do next, how this screen works, or how STRATUM Edge can help with estimating, projects, RFIs, RFQs, suppliers, job costs and commercial intelligence.`,
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
        body: JSON.stringify({ message, pathname, organizationId, accountId }),
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
    <div className="fixed bottom-14 right-4 z-[70] sm:right-[72px]">
      {open && (
        <section className="mb-3 flex h-[min(620px,70vh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden border border-[#C97C3D] bg-[#0E2438] shadow-2xl">
          <header className="flex items-center justify-between border-b border-[#1C3A57] bg-[#0B1F32] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center border border-[#6FD6C9] text-[#6FD6C9]"><Bot className="h-4 w-4" /></span>
              <div>
                <div className="font-semibold uppercase tracking-[0.05em] text-[#DCEBF5]">Jarvis</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#6D8AA0]">{accountName} · STRATUM Edge aware</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-[#9FB6C7] hover:text-white" aria-label="Close Jarvis"><X className="h-4 w-4" /></button>
          </header>

          <div className="border-b border-[#1C3A57] bg-[#081725] px-3 py-2">
            <div className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.05em] text-[#6D8AA0]">
              <span className="flex items-center gap-1"><Database className="h-3 w-3 text-[#6FD6C9]" /> 1 Local account data</span>
              <span>→</span>
              <span className="flex items-center gap-1"><Globe2 className="h-3 w-3 text-[#E0954F]" /> 2 Web research</span>
              <span>→</span>
              <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-[#E8B339]" /> 3 AI synthesis</span>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "ml-8" : "mr-5"}>
                <div className={message.role === "user" ? "border border-[#C97C3D] bg-[#C97C3D]/10 p-3 text-sm text-[#F1D6BF]" : "border border-[#1C3A57] bg-[#0A1A2B]/60 p-3 text-sm leading-6 text-[#DCEBF5]"}>
                  {message.text}
                </div>
              </div>
            ))}
            {busy && <div className="mr-5 flex items-center gap-2 border border-[#1C3A57] bg-[#0A1A2B]/60 p-3 font-mono text-[11px] text-[#6FD6C9]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the authorized account context…</div>}
          </div>

          <div className="border-t border-[#1C3A57] p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["What should I do next?", "Explain this screen", "Which STRATUM Edge tool helps here?"].map((prompt) => (
                <button key={prompt} type="button" onClick={() => setInput(prompt)} className="border border-[#1C3A57] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.04em] text-[#9FB6C7] hover:border-[#6FD6C9] hover:text-[#6FD6C9]">{prompt}</button>
              ))}
            </div>
            <form onSubmit={submit} className="flex gap-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} maxLength={4000} placeholder="Ask Jarvis for guidance…" className="min-h-[54px] flex-1 resize-none border border-[#1C3A57] bg-[#0A1A2B] px-3 py-2 text-sm text-[#DCEBF5] outline-none placeholder:text-[#6D8AA0] focus:border-[#C97C3D]" />
              <button disabled={busy || !input.trim()} className="flex w-11 items-center justify-center border border-[#C97C3D] text-[#E0954F] hover:bg-[#C97C3D] hover:text-[#0A1A2B] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send to Jarvis"><Send className="h-4 w-4" /></button>
            </form>
            <p className="mt-2 font-mono text-[9px] leading-4 text-[#6D8AA0]">GUIDANCE MODE · Account scoped · STRATUM Edge actions remain subject to RBAC, audit and explicit approval.</p>
          </div>
        </section>
      )}

      <button onClick={() => setOpen((value) => !value)} className="group flex items-center gap-2 border border-[#C97C3D] bg-[#0B1F32] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#E0954F] shadow-xl transition hover:bg-[#C97C3D] hover:text-[#0A1A2B] max-sm:mb-[52px]">
        {open ? <ChevronDown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        Jarvis
      </button>
    </div>
  );
}
