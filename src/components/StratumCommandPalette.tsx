"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, ClipboardList, FolderKanban, Gauge, Home, PackageSearch, ReceiptText, Search, Sparkles, Truck, X } from "lucide-react";

type Command = { label: string; hint: string; href?: string; keywords: string; icon: typeof Search; action?: () => void };

export default function StratumCommandPalette({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.key === "/" && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("stratum-command-open", onOpen as EventListener);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("stratum-command-open", onOpen as EventListener); };
  }, []);

  const askJarvis = (prompt?: string) => {
    window.dispatchEvent(new CustomEvent("stratum-jarvis-open", { detail: { prompt: prompt || "" } }));
    setOpen(false);
    setQuery("");
  };

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { label: "Home", hint: "Go to Action Center", href: "/dashboard", keywords: "home dashboard attention action center", icon: Home },
      { label: "Create estimate", hint: "Start a new estimate", href: "/costing/estimates/new", keywords: "new create estimate bid pricing", icon: ReceiptText },
      { label: "Open estimates", hint: "Browse estimates", href: "/costing/estimates", keywords: "estimate bids pricing", icon: Calculator },
      { label: "Open projects", hint: "Projects, RFIs, RFQs and takeoff", href: "/projects", keywords: "project rfi rfq takeoff drawings", icon: FolderKanban },
      { label: "Cost Library", hint: "Labor and material items", href: "/costing/items", keywords: "cost items labor material library", icon: PackageSearch },
      { label: "Suppliers", hint: "Supplier directory", href: "/suppliers", keywords: "supplier vendor procurement", icon: Truck },
      { label: "Job Costs", hint: "Actual labor and material", href: "/costing/job-costs", keywords: "actual history job costs labor", icon: ClipboardList },
      { label: "STRATUM Edge", hint: "Commercial intelligence", href: "/edge", keywords: "edge revision scope health bid leveling risk benchmark progress", icon: Gauge },
      { label: "Ask Jarvis", hint: "Guidance for the current screen", keywords: "jarvis help explain guide assistant", icon: Sparkles, action: () => askJarvis() },
      { label: "Jarvis: what should I do next?", hint: "Get a context-aware next step", keywords: "next help guide", icon: Sparkles, action: () => askJarvis("What should I do next?") },
      { label: "Jarvis: explain this screen", hint: "Explain the current workspace", keywords: "explain page screen help", icon: Sparkles, action: () => askJarvis("Explain this screen") },
    ];
    if (isAdmin) list.push({ label: "Admin", hint: "Users, access and account controls", href: "/admin", keywords: "admin users rbac permissions", icon: Gauge });
    return list;
  }, [isAdmin]);

  const filtered = commands.filter((command) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${command.label} ${command.hint} ${command.keywords}`.toLowerCase().includes(q);
  });

  const run = (command: Command) => {
    if (command.action) command.action();
    else if (command.href) { router.push(command.href); setOpen(false); setQuery(""); }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-14 left-[168px] z-[71] hidden items-center gap-2 border border-[#1C3A57] bg-[#0B1F32]/95 px-3 py-2 font-mono text-[9px] uppercase tracking-[.06em] text-[#9FB6C7] shadow-xl backdrop-blur hover:border-[#6FD6C9] hover:text-[#6FD6C9] md:flex" aria-label="Open command palette">
      <Search className="h-3.5 w-3.5"/> Quick find <span className="border border-[#1C3A57] px-1.5 py-0.5 text-[8px]">/</span>
    </button>
    {open && <div className="fixed inset-0 z-[120] flex items-start justify-center bg-[#020A12]/75 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.currentTarget === e.target) setOpen(false); }}>
      <section className="w-full max-w-2xl overflow-hidden border border-[#C97C3D] bg-[#0B1F32] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#1C3A57] px-4 py-3">
          <Search className="h-4 w-4 text-[#6FD6C9]"/>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) run(filtered[0]); }} placeholder="Go anywhere, create something, or ask Jarvis…" className="min-w-0 flex-1 bg-transparent text-sm text-[#DCEBF5] outline-none placeholder:text-[#6D8AA0]" />
          <button type="button" onClick={() => setOpen(false)} className="text-[#6D8AA0] hover:text-white"><X className="h-4 w-4"/></button>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2">
          {filtered.length === 0 ? <div className="px-4 py-10 text-center text-sm text-[#6D8AA0]">No match. Try a simpler word, or ask Jarvis.</div> : filtered.map((command) => {
            const Icon = command.icon;
            return <button key={command.label} type="button" onClick={() => run(command)} className="flex w-full items-center gap-3 border-b border-[#1C3A57]/50 px-3 py-3 text-left last:border-0 hover:bg-[#102A42]">
              <span className="flex h-8 w-8 items-center justify-center border border-[#1C3A57] text-[#6FD6C9]"><Icon className="h-4 w-4"/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#DCEBF5]">{command.label}</span><span className="mt-0.5 block text-xs text-[#6D8AA0]">{command.hint}</span></span>
              <span className="font-mono text-[9px] text-[#C97C3D]">OPEN →</span>
            </button>;
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1C3A57] bg-[#081725] px-4 py-2 font-mono text-[8px] uppercase tracking-[.05em] text-[#6D8AA0]"><span>⌘/Ctrl K or / · Enter opens first match</span><span>Capability without navigation clutter</span></div>
      </section>
    </div>}
  </>;
}
