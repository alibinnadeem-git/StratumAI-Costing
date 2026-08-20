import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";
import { calculateEstimate, laborHoursForCondition } from "@/lib/costing";

const csv=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;

export async function GET(_req:Request,{params}:{params:Promise<{estimateId:string}>}){
  const {estimateId}=await params; const ctx=await requireOrgContext();
  const e=await db.costEstimate.findFirst({where:{id:estimateId,organizationId:ctx.organization.id},include:{lineItems:true,adders:true,project:true}}); if(!e) notFound();
  const totals=calculateEstimate({lines:e.lineItems,adders:e.adders,laborRate:e.laborRate,overheadPercent:e.overheadPercent,profitMarginPercent:e.profitMarginPercent,difficultyMultiplier:e.difficultyMultiplier,condition:e.condition});
  const rows:any[][]=[["Estimate",`EST-${String(e.number).padStart(4,"0")}`],["Name",e.name],["Project",e.project?.name??""],["Status",e.status],["Condition",e.condition],["Labor Rate",e.laborRate],["Overhead %",e.overheadPercent],["Profit %",e.profitMarginPercent],[],["Description","Category","Quantity","Unit","Labor Hrs/Unit Effective","Material/Unit","Labor Extended","Material Extended"]];
  for(const l of e.lineItems){const hrs=laborHoursForCondition(l,e.condition)*e.difficultyMultiplier; rows.push([l.description,l.category??"",l.quantity,l.unit,hrs,l.materialCost,hrs*l.quantity*e.laborRate,l.materialCost*l.quantity]);}
  rows.push([], ["Material Total",totals.material],["Labor Hours",totals.laborHours],["Labor Total",totals.labor],["Adders",totals.adders],["Overhead",totals.overhead],["Profit",totals.profit],["Estimated Price",totals.total]);
  const body=rows.map(r=>r.map(csv).join(",")).join("\n");
  return new Response(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="estimate-${e.number}.csv"`}});
}
