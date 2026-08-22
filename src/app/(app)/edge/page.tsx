import Link from "next/link";
import { Activity, GitCompareArrows, HeartPulse, History, Radar, ScanSearch, TrendingUp } from "lucide-react";

const tools = [
  ["revision-impact","Revision Impact","Connect revisions to quantity, labor, material, procurement, schedule and margin impact.",GitCompareArrows],
  ["scope-gap","Scope Gap Detection","Cross-check takeoff, estimate, RFIs, vendor scope and exclusions for missing or conflicting scope.",ScanSearch],
  ["estimate-health","Estimate Health","Check pricing freshness, labor verification, unresolved RFIs, stale quotes and estimate readiness.",HeartPulse],
  ["bid-leveling","Bid Leveling","Compare supplier price, exclusions, alternates, lead times, freight and commercial value.",TrendingUp],
  ["procurement-risk","Procurement Risk","Surface quote expiry, lead-time exposure, unanswered RFQs and supplier dependencies.",Activity],
  ["historical-benchmark","Historical Benchmark","Compare current assumptions with actual labor and material performance from prior jobs.",History],
  ["progress-intelligence","Progress Intelligence","Relate estimated quantity, installed quantity, earned labor, actual cost and remaining exposure.",Radar],
] as const;

export default function EdgeHubPage(){return <div className="space-y-6"><section className="stratum-sheet"><div className="font-mono text-[10px] uppercase tracking-[.12em] text-[#6FD6C9]">STRATUM Edge</div><h1 className="mt-2 text-2xl font-semibold text-[#DCEBF5]">Choose an intelligence workflow</h1><p className="mt-2 max-w-3xl text-sm text-[#9FB6C7]">Every Edge shortcut now lands in a dedicated workspace first, so you always know what the tool does, what data it uses, and where to continue.</p></section><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tools.map(([slug,label,text,Icon])=><Link key={slug} href={`/edge/${slug}`} className="stratum-sheet group block min-h-[180px] transition hover:border-[#C97C3D]"><Icon className="h-5 w-5 text-[#6FD6C9]"/><h2 className="mt-5 text-base font-semibold text-[#DCEBF5] group-hover:text-[#E0954F]">{label}</h2><p className="mt-2 text-sm leading-6 text-[#9FB6C7]">{text}</p><div className="mt-4 font-mono text-[10px] uppercase tracking-[.08em] text-[#E0954F]">Open STRATUM Edge →</div></Link>)}</div></div>}
