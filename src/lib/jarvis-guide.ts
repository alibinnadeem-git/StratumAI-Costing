export type JarvisGuideContext = {
  pathname?: string;
  organization?: string;
  account?: string;
  role?: string;
};

const ROUTE_GUIDANCE: Array<{ match: string; title: string; guidance: string }> = [
  { match: "/costing/items", title: "Item Database", guidance: "Use Item Database to create, edit, calibrate, archive, restore, filter and source-tag estimating items. Verified NECA rows, supplier quotes and job-cost actuals should remain visibly distinguishable from manual placeholders." },
  { match: "/costing/estimates", title: "Estimate Builder", guidance: "Build estimates from tenant-owned cost items, project takeoffs, custom lines and adders. Link an estimate to a project when you want takeoff, RFI, RFQ, supplier and job-cost context to travel with the estimate." },
  { match: "/costing/job-costs", title: "Job Cost History", guidance: "Record actual labor and material outcomes after work is performed. Approved actuals can calibrate future tenant-specific labor and material assumptions instead of overwriting source data blindly." },
  { match: "/costing/quotes", title: "Supplier Quotes", guidance: "Capture quote date, validity, supplier, project, item mapping, quantity, unit cost, exclusions and notes. Current approved quotes can update estimating material assumptions with a traceable audit trail." },
  { match: "/costing/market", title: "Market Intelligence", guidance: "Track external material, labor and macro cost factors. Market factors should support cited sources, effective dates, affected cost domains and explicit user approval before changing estimate assumptions." },
  { match: "/costing/neca", title: "NECA Labor Library", guidance: "Search source-checked NECA labor rows and import only verified values into the tenant cost database. Keep normal, difficult and very-difficult conditions traceable to their source row." },
  { match: "/projects", title: "Projects", guidance: "Projects are tenant-owned commercial workspaces. They connect takeoffs, RFIs, RFQs, suppliers, estimates, quotes, job costs, documents and audit history." },
  { match: "/suppliers", title: "Suppliers", guidance: "Maintain supplier master records, contacts, categories, quote history, RFQ participation and performance context. Supplier data belongs to the active account/tenant." },
  { match: "/admin", title: "Administration", guidance: "Administration controls users, memberships, organization/account access, roles, audit visibility and platform-level functions. Jarvis must never bypass the same RBAC checks used by the normal UI." },
  { match: "/organizations", title: "Organizations", guidance: "Organizations sit below the multi-org platform and contain one or more isolated accounts/tenants. Operational data belongs to an account; organization access governs which accounts a user may be assigned to." },
];

export function localJarvisReply(message: string, context: JarvisGuideContext) {
  const q = message.toLowerCase();
  const route = ROUTE_GUIDANCE.find((entry) => context.pathname?.startsWith(entry.match));

  if (/what (is|does) this|where am i|this screen|this page/.test(q) && route) {
    return `${route.title}: ${route.guidance}`;
  }
  if (/estimate|bid|takeoff/.test(q)) {
    return "For estimating, start with the tenant Item Database, create or open an Estimate, link the Project when available, import the latest takeoff, review labor/material assumptions, add commercial adders, then validate quote freshness, unresolved RFIs and manual-placeholder exposure before submission.";
  }
  if (/rfi/.test(q)) {
    return "RFIs should be linked to the tenant project, affected drawing/sheet, question, priority, required date, responsible user and commercial exposure. The target workflow is detect issue → draft RFI → approval/send → response → quantify cost/schedule effect → update estimate or project record.";
  }
  if (/rfq|quote|supplier|vendor/.test(q)) {
    return "RFQ automation should group required material from takeoff/estimate lines, select approved tenant suppliers, issue requests, capture responses, normalize exclusions/lead times, level bids and—after approval—apply the chosen commercial values back to the estimate.";
  }
  if (/bluebeam|revision|drawing|overlay/.test(q)) {
    return "The intended Bluebeam-adjacent workflow is drawing/revision detection → quantity delta → cost and labor delta → affected RFI/RFQ/procurement → margin and schedule exposure. Stratum should automate the commercial handoffs rather than merely reproduce PDF markup.";
  }
  if (/permission|role|rbac|delete|access/.test(q)) {
    return "Access is enforced by platform, organization and account/tenant roles. Jarvis guidance can explain any record, but write/delete/send actions must use the same server-side RBAC checks and should require explicit approval for destructive or external actions.";
  }
  if (/help|how do i|guide|guidance/.test(q) && route) {
    return `${route.guidance} Tell me what outcome you want on this screen and I can guide the exact workflow.`;
  }

  return route
    ? `You are in ${route.title}. ${route.guidance} Ask me about estimating, RFIs/RFQs, suppliers, project risk, permissions, revision impact or how to use this screen.`
    : "I can guide Stratum workflows across costing, estimates, projects, RFIs, RFQs, suppliers, job costs, market intelligence, RBAC and account/tenant operations. Ask what you want to accomplish and I will map the workflow.";
}
