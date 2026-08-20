import { requireOrgContext } from "@/lib/session";
import { db } from "@/lib/db";

const csv = (v: unknown) => `"${String(v ?? "").replaceAll('"','""')}"`;

export async function GET(){
  const ctx=await requireOrgContext();
  const items=await db.costItem.findMany({where:{organizationId:ctx.organization.id},orderBy:[{category:"asc"},{description:"asc"}]});
  const rows=[
    ["Description","Category","Unit","Labor Hours / Unit","Material Cost","Source","NECA Source Page","NECA Normal","NECA Difficult","NECA Very Difficult","Verified","Notes"],
    ...items.map(i=>[i.description,i.category,i.unit,i.laborHoursPerUnit,i.materialCost,i.source,i.necaSourcePage??"",i.necaNormal??"",i.necaDifficult??"",i.necaVeryDifficult??"",i.necaVerified?"Yes":"No",i.notes??""])
  ];
  const body=rows.map(r=>r.map(csv).join(",")).join("\n");
  return new Response(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${ctx.organization.slug}-cost-items.csv"`}});
}
