import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  Boxes,
  Building2,
  ClipboardList,
  FileQuestion,
  FolderKanban,
  Gauge,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { requireTenantContext } from "@/lib/session";
import { atLeast } from "@/lib/rbac";
import JarvisCopilot from "@/components/JarvisCopilot";
import { signOutAction } from "./actions";
import OrgSwitcher from "./OrgSwitcher";
import AccountSwitcher from "./AccountSwitcher";

const CORE_NAV = [
  { href: "/costing/items", label: "Item Database", icon: Boxes },
  { href: "/costing/estimates", label: "Estimate Builder", icon: ReceiptText },
  { href: "/costing/job-costs", label: "Job Cost History", icon: ClipboardList },
  { href: "/costing/quotes", label: "Supplier Quotes", icon: ShoppingCart },
  { href: "/costing", label: "Analytics", icon: BarChart3 },
  { href: "/costing/market", label: "Market Intel", icon: Gauge },
  { href: "/costing/neca", label: "NECA Labor", icon: BookOpenCheck },
  { href: "/costing/settings", label: "Settings", icon: Settings2 },
];

const OPERATIONS_NAV = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/projects", label: "RFIs", icon: FileQuestion },
  { href: "/projects", label: "RFQs", icon: ShoppingCart },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenantContext();
  const isAdmin = atLeast(ctx.accountRole, "ADMIN");

  return (
    <div className="stratum-workspace">
      <header className="stratum-shell sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-4 px-4 pb-3 pt-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/costing/items" className="group flex min-w-0 items-center gap-4">
              <span className="stratum-brand-mark"><span className="relative z-10 text-sm">S</span></span>
              <span className="min-w-0">
                <span className="block truncate text-[18px] font-bold uppercase tracking-[0.04em] text-[#DCEBF5]">Stratum AI Costing Tool</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.06em] text-[#6D8AA0]">
                  Item Database · Takeoff · Supplier Quotes · Job-Cost Calibration
                </span>
              </span>
            </Link>
          </div>

          <div className="flex flex-wrap items-end justify-end gap-3">
            {ctx.memberships.length > 1 ? (
              <OrgSwitcher
                current={ctx.organization.id}
                options={ctx.memberships.map((m) => ({ id: m.organizationId, name: m.organization.name }))}
              />
            ) : (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="stratum-context-label">Organization</span>
                <span className="max-w-[220px] truncate font-mono text-[11px] text-[#DCEBF5]">{ctx.organization.name}</span>
              </div>
            )}

            <AccountSwitcher
              current={ctx.account.id}
              options={ctx.accountMemberships.map((membership) => ({
                id: membership.accountId,
                name: membership.account.name,
              }))}
            />

            <div className="flex flex-col gap-1">
              <span className="stratum-context-label">Account Access</span>
              <span className="stratum-role">{ctx.accountRole}</span>
            </div>

            {ctx.user.systemRole === "SUPER_ADMIN" && (
              <div className="flex flex-col gap-1">
                <span className="stratum-context-label">Platform</span>
                <span className="stratum-role border-[#E8B339] !text-[#E8B339]">SUPER ADMIN</span>
              </div>
            )}

            <form action={signOutAction} className="pb-0.5">
              <button className="border border-[#1C3A57] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#9FB6C7] transition hover:border-[#C97C3D] hover:text-[#E0954F]">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="stratum-tabs overflow-x-auto">
          <nav className="mx-auto flex min-w-max max-w-[1280px] items-center px-3 sm:px-7" aria-label="Costing workspace">
            {CORE_NAV.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link key={item.href + item.label} href={item.href} className="stratum-tab">
                  <span className="stratum-tab-index">{String(index + 1).padStart(2, "0")}</span>
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="overflow-x-auto border-b border-[#1C3A57] bg-[#0A1A2B]/95">
          <nav className="mx-auto flex min-w-max max-w-[1280px] items-center px-3 sm:px-7" aria-label="Project operations">
            <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#6D8AA0]">Operations</span>
            {OPERATIONS_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} className="stratum-tab !py-2">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
            <Link href="/organizations" className="stratum-tab !py-2">
              <Building2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              Organizations
            </Link>
            {isAdmin && (
              <Link href="/admin" className="stratum-tab !py-2">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                Admin
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="stratum-main">{children}</main>

      <JarvisCopilot
        organizationId={ctx.organization.id}
        organizationName={ctx.organization.name}
        accountId={ctx.account.id}
        accountName={ctx.account.name}
      />

      <footer className="stratum-titleblock">
        <span>DWG <b>SC-EST-001</b></span>
        <span className="divider">|</span>
        <span>ORG <b>{ctx.organization.name.toUpperCase()}</b></span>
        <span className="divider">|</span>
        <span>ACCOUNT <b>{ctx.account.name.toUpperCase()}</b></span>
        <span className="divider">|</span>
        <span>WORKSPACE <b>SERVER-BACKED</b></span>
        <span className="divider">|</span>
        <span>RBAC <b>{ctx.accountRole}</b></span>
        <span className="divider">|</span>
        <span>REV <b>TENANT-FIRST</b></span>
      </footer>
    </div>
  );
}
