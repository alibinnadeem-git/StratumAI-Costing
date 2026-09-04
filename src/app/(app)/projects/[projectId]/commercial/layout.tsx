import type { ReactNode } from "react";
import { requireTenantContext } from "@/lib/session";
import SpatialRiskPanel from "./SpatialRiskPanel";

export default async function CommercialLayout({children,params}:{children:ReactNode;params:Promise<{projectId:string}>}){
  const {projectId}=await params;const ctx=await requireTenantContext();
  return <div className="space-y-5">{children}<SpatialRiskPanel projectId={projectId} accountId={ctx.account.id}/></div>;
}
