import Link from "next/link";
import { Calculator, Database, FileSpreadsheet, History, LibraryBig, LineChart, Settings2, Tags } from "lucide-react";

const NAV = [
  ["/costing", "Overview", Calculator],
  ["/costing/items", "Item Database", Database],
  ["/costing/estimates", "Estimates", FileSpreadsheet],
  ["/costing/job-costs", "Job Cost History", History],
  ["/costing/quotes", "Supplier Quotes", Tags],
  ["/costing/neca", "NECA Library", LibraryBig],
  ["/costing/market", "Market Intel", LineChart],
  ["/costing/settings", "Settings", Settings2],
] as const;

export default function CostingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-card">
        <nav className="flex min-w-max gap-1">
          {NAV.map(([href,label,Icon]) => (
            <Link key={href} href={href} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
