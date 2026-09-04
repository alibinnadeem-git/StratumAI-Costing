import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";

const DRAWING_TYPES=["ELECTRICAL","ARCHITECTURAL","MECHANICAL","PLUMBING","CIVIL","STRUCTURAL","GENERAL","AS_BUILT","ADDENDUM"];
type Row={documentId:string;documentName:string;documentType:string;documentRevisionId:string|null;revision:string|null;issuedAt:Date|null;ingestionCount:bigint;ingestedCount:bigint;reviewCount:bigint;exceptionCount:bigint;maxUpdatedAt:Date|null};

export default async function DrawingCoveragePage({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params; const ctx=await requireTenantContext(); const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}});if(!project)notFound();
  const rows=await db.$queryRawUnsafe<Row[]>(`WITH sources AS (
    SELECT d."id" AS "documentId",d."name" AS "documentName",d."documentType",r."id" AS "documentRevisionId",r."revision",r."issuedAt"
    FROM "ProjectDocument" d LEFT JOIN "ProjectDocumentRevision" r ON r."documentId"=d."id" AND r."accountId"=d."accountId"
    WHERE d."projectId"=$1 AND d."accountId"=$2 AND d."documentType" = ANY($3::text[])
  )
  SELECT s."documentId",s."documentName",s."documentType",s."documentRevisionId",s."revision",s."issuedAt",
    COUNT(i."id")::bigint AS "ingestionCount",
    COUNT(i."id") FILTER (WHERE i."status"='INGESTED')::bigint AS "ingestedCount",
    COUNT(i."id") FILTER (WHERE i."status" IN ('REVIEW','QUEUED'))::bigint AS "reviewCount",
    COUNT(i."id") FILTER (WHERE i."status" IN ('FAILED','REJECTED'))::bigint AS "exceptionCount",
    MAX(i."updatedAt") AS "maxUpdatedAt"
  FROM sources s LEFT JOIN "PlanRoomDrawingIngestion" i ON i."documentId"=s."documentId" AND i."accountId"=$2 AND ((s."documentRevisionId" IS NOT NULL AND i."documentRevisionId"=s."documentRevisionId") OR (s."documentRevisionId" IS NULL AND i."documentRevisionId" IS NULL))
  GROUP BY s."documentId",s."documentName",s."documentType",s."documentRevisionId",s."revision",s."issuedAt"
  ORDER BY COALESCE(s."issuedAt",TIMESTAMP '1900-01-01') DESC,s."documentName",s."revision"`,projectId,ctx.account.id,DRAWING_TYPES);
  const uncovered=rows.filter(r=>Number(r.ingestionCount)===0); const active=rows.filter(r=>Number(r.reviewCount)>0); const covered=rows.filter(r=>Number(r.ingestedCount)>0);
  return <div className="space-y-5"><section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Plan Room · Drawing Coverage</p><h1 className="stratum-sheet-title">{project.name} Source Coverage</h1><p className="mt-2 max-w-4xl text-sm text-[#9CB2C2]">Audit every drawing-capable Plan Room source against the drawing-ingestion queue. An uncovered revision means no page from that source has been reviewed yet.</p></div><div className="flex gap-2"><Link href={`/projects/${projectId}/plan-room/drawing-ingestion`} className="btn">Drawing Intake</Link><Link href={`/projects/${projectId}/plan-room`} className="btn-secondary">Plan Room</Link></div></div></section><section className="grid gap-3 sm:grid-cols-3"><div className="stratum-sheet"><div className="cat">Uncovered revisions</div><div className="mt-2 text-2xl font-semibold text-[#E0954F]">{uncovered.length}</div></div><div className="stratum-sheet"><div className="cat">In review</div><div className="mt-2 text-2xl font-semibold text-[#DCEBF5]">{active.length}</div></div><div className="stratum-sheet"><div className="cat">With ingested sheets</div><div className="mt-2 text-2xl font-semibold text-[#6FD6C9]">{covered.length}</div></div></section><section className="stratum-sheet"><div className="table-scroll"><table className="min-w-[1050px]"><thead><tr><th>Plan Room source</th><th>Revision</th><th>Issued</th><th className="num">Pages tracked</th><th className="num">Review</th><th className="num">Ingested</th><th className="num">Exceptions</th><th>Status</th></tr></thead><tbody>{rows.map(r=>{const total=Number(r.ingestionCount),review=Number(r.reviewCount),ingested=Number(r.ingestedCount),exceptions=Number(r.exceptionCount);const status=total===0?"UNCOVERED":review>0?"REVIEW":ingested>0?"COVERED":exceptions>0?"EXCEPTION":"TRACKED";return <tr key={`${r.documentId}-${r.documentRevisionId||"current"}`}><td><div className="font-semibold text-[#DCEBF5]">{r.documentName}</div><div className="cat">{r.documentType}</div></td><td>{r.revision?`Rev ${r.revision}`:"Current / no revision record"}</td><td>{r.issuedAt?new Date(r.issuedAt).toISOString().slice(0,10):"—"}</td><td className="num">{total}</td><td className="num">{review}</td><td className="num">{ingested}</td><td className="num">{exceptions}</td><td><span className="tag REF">{status}</span></td></tr>;})}{rows.length===0&&<tr><td colSpan={8}>No drawing-capable Plan Room sources.</td></tr>}</tbody></table></div></section></div>;
}
