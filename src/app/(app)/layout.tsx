import Link from "next/link";
import { Building2, Calculator, FolderKanban, LayoutDashboard, ShieldCheck, Truck, Zap } from "lucide-react";
import { requireOrgContext } from "@/lib/session";
import { atLeast } from "@/lib/rbac";
import { signOutAction } from "./actions";
import OrgSwitcher from "./OrgSwitcher";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/costing", label: "Costing", icon: Calculator },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/organizations", label: "Organizations", icon: Building2 },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();
  const isAdmin = atLeast(ctx.role, "ADMIN");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden border-b border-graphite-700/60 bg-graphite-950 text-white">
        <div className="bp-grid-dark pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal-400/30 bg-signal-500/10 text-signal-300 shadow-glow transition-transform group-hover:scale-105">
                <Zap className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="hidden sm:block"><span className="block text-sm font-semibold tracking-tight">Stratum AI</span><span className="block text-[9px] uppercase tracking-[0.16em] text-slate-500">Costing + Project Operations</span></span>
            </Link>
            <nav className="hidden gap-1 lg:flex">
              {NAV.map((item) => { const Icon=item.icon; return <Link key={item.href} href={item.href} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"><Icon className="h-3.5 w-3.5" />{item.label}</Link>; })}
              {isAdmin && <Link href="/admin" className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"><ShieldCheck className="h-3.5 w-3.5" />Admin</Link>}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {ctx.memberships.length > 1 ? <OrgSwitcher current={ctx.organization.id} options={ctx.memberships.map((m)=>({id:m.organizationId,name:m.organization.name}))}/> : <span className="max-w-[180px] truncate text-xs font-medium text-slate-300">{ctx.organization.name}</span>}
            <span className="rounded-full border border-graphite-600 bg-graphite-800 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide text-slate-300">{ctx.role}</span>
            {ctx.user.systemRole === "SUPER_ADMIN" && <span className="hidden rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[9px] font-bold text-amber-300 sm:inline">PLATFORM</span>}
            <form action={signOutAction}><button className="text-xs font-medium text-slate-400 transition-colors hover:text-white">Sign out</button></form>
          </div>
        </div>
        <div className="relative overflow-x-auto border-t border-white/5 lg:hidden"><nav className="mx-auto flex min-w-max max-w-7xl gap-1 px-4 py-1.5">{NAV.map((item)=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-slate-300"><Icon className="h-3.5 w-3.5"/>{item.label}</Link>})}{isAdmin&&<Link href="/admin" className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-slate-300"><ShieldCheck className="h-3.5 w-3.5"/>Admin</Link>}</nav></div>
      </div>
      <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
    </div>
  );
}
