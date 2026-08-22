"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  GitCompareArrows,
  HeartPulse,
  History,
  Radar,
  ScanSearch,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";

type EdgeTool = {
  id: string;
  label: string;
  short: string;
  href: string;
  icon: typeof Radar;
  description: string;
  gap: string;
  contexts: string[];
};

const EDGE_TOOLS: EdgeTool[] = [
  {
    id: "revision",
    label: "Revision Impact",
    short: "Revision",
    href: "/projects",
    icon: GitCompareArrows,
    description: "Connect drawing changes to quantity, labor, material, procurement, schedule and margin impact.",
    gap: "Moves beyond visual drawing comparison into commercial impact analysis.",
    contexts: ["/projects", "/costing/estimates"],
  },
  {
    id: "scope",
    label: "Scope Gap Detection",
    short: "Scope",
    href: "/costing/estimates",
    icon: ScanSearch,
    description: "Cross-check drawings, takeoff, estimate, RFIs, vendor scope and exclusions for missing or conflicting scope.",
    gap: "Turns document review into an actionable completeness and risk check.",
    contexts: ["/projects", "/costing/estimates"],
  },
  {
    id: "health",
    label: "Estimate Health",
    short: "Health",
    href: "/costing/estimates",
    icon: HeartPulse,
    description: "Assess pricing freshness, labor verification, unresolved RFIs, stale quotes, placeholders and estimate readiness.",
    gap: "Adds bid-risk and estimate-readiness intelligence to takeoff and review workflows.",
    contexts: ["/costing/estimates", "/costing/items"],
  },
  {
    id: "leveling",
    label: "Bid Leveling",
    short: "Level",
    href: "/costing/quotes",
    icon: TrendingUp,
    description: "Compare supplier price, exclusions, alternates, lead times, freight, escalation clauses and total commercial value.",
    gap: "Automates the spreadsheet-heavy handoff between quote collection and award decisions.",
    contexts: ["/suppliers", "/costing/quotes", "/projects"],
  },
  {
    id: "procurement",
    label: "Procurement Risk",
    short: "Risk",
    href: "/suppliers",
    icon: Activity,
    description: "Surface quote expiry, lead-time exposure, unanswered RFQs and supplier dependencies before they affect schedule or margin.",
    gap: "Connects pricing and procurement timing to project commercial risk.",
    contexts: ["/suppliers", "/projects", "/costing/quotes"],
  },
  {
    id: "history",
    label: "Historical Benchmark",
    short: "History",
    href: "/costing/job-costs",
    icon: History,
    description: "Compare current assumptions with actual labor, material and performance from similar completed work.",
    gap: "Closes the loop from estimate to actuals so the next estimate learns from project history.",
    contexts: ["/costing/job-costs", "/costing/estimates", "/costing/items"],
  },
  {
    id: "progress",
    label: "Progress Intelligence",
    short: "Progress",
    href: "/costing/job-costs",
    icon: Radar,
    description: "Relate estimated quantity, installed quantity, earned labor, actual cost and remaining exposure.",
    gap: "Bridges takeoff quantities with production, cost variance and forecast-to-complete workflows.",
    contexts: ["/projects", "/costing/job-costs"],
  },
];

export default function StratumEdgeRail() {
  const pathname = usePathname();
  const [active, setActive] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(false);

  return (
    <aside className="stratum-edge-rail" aria-label="STRATUM Edge quick intelligence">
      <button
        type="button"
        onClick={() => setIntroOpen((v) => !v)}
        className="stratum-edge-brand"
        aria-label="About STRATUM Edge"
      >
        <Sparkles className="h-4 w-4" />
        <span>EDGE</span>
      </button>

      {introOpen && (
        <div className="stratum-edge-intro">
          <button type="button" onClick={() => setIntroOpen(false)} className="stratum-edge-close" aria-label="Close STRATUM Edge introduction"><X className="h-3.5 w-3.5" /></button>
          <div className="stratum-edge-kicker">STRATUM Edge</div>
          <div className="stratum-edge-intro-title">Intelligence beyond the drawing.</div>
          <p>Use these shortcuts to move from documents and takeoff into commercial decisions, automation and learning.</p>
          <div className="stratum-edge-lifecycle">
            <span>SCAN</span><b>→</b><span>FINDING</span><b>→</b><span>RECOMMEND</span><b>→</b><span>ACTION</span><b>→</b><span className="verified"><BadgeCheck className="h-3 w-3" /> STRATUM Edge Verified</span>
          </div>
        </div>
      )}

      <div className="stratum-edge-tools">
        {EDGE_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const relevant = tool.contexts.some((prefix) => pathname.startsWith(prefix));
          const isActive = active === tool.id;
          return (
            <div key={tool.id} className="stratum-edge-tool-wrap">
              <button
                type="button"
                onMouseEnter={() => setActive(tool.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(tool.id)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(isActive ? null : tool.id)}
                className={`stratum-edge-tool ${relevant ? "is-relevant" : ""}`}
                aria-label={tool.label}
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                <span className="stratum-edge-tool-label">{tool.short}</span>
                {relevant && <span className="stratum-edge-pip" />}
              </button>

              {isActive && (
                <div className="stratum-edge-balloon" onMouseEnter={() => setActive(tool.id)} onMouseLeave={() => setActive(null)}>
                  <div className="stratum-edge-balloon-kicker">STRATUM Edge</div>
                  <div className="stratum-edge-balloon-title">{tool.label}</div>
                  <p>{tool.description}</p>
                  <div className="stratum-edge-gap"><b>Gap covered:</b> {tool.gap}</div>
                  <Link href={tool.href} className="stratum-edge-open">Open workspace →</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
