import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/session";
import { getDrawingWorkspace } from "@/lib/drawing-native";
import { verifyTakeoffObjectAction } from "../actions";

export default async function DrawingReviewPage({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  const ctx=await requireTenantContext();
  const project=await db.project.findFirst({where:{id:projectId,accountId:ctx.account.id}}); if(!project) notFound();
  const {revisions,layers,objects}=await getDrawingWorkspace(projectId,ctx.account.id);
  const review=objects.filter(o=>!o.verifiedAt||(o.confidence??0)<.8||((o.objectType==="LINEAR"||o.objectType==="AREA")&&!o.calibrationId));
  const critical=review.filter(o=>((o.objectType==="LINEAR"||o.objectType==="AREA")&&!o.calibrationId)||(o.confidence??0)<.7);
  return <div className="space-y-5">
    <section className="stratum-sheet"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6D8AA0]">Takeoff QA</p><h1 className="stratum-sheet-title">{project.name} Review Queue</h1><p className="mt-2 max-w-4xl text-sm text-[#9CB2C2]">Unverified, low-confidence, and uncalibrated measured scope is held here for review before commercial conversion.</p></div><div className="flex gap-2"><Link href={`/projects/${projectId}/drawings/calibration`} className="btn-secondary">Calibration</Link><Link href={`/projects/${projectId}/drawings/viewer`} className="btn-secondary">Spatial Viewer</Link><Link href={`/projects/${projectId}/drawings`} className="btn-secondary">Workspace</Link></div></div></section>
    <section className="grid gap-3 sm:grid-cols-3"><div className="stratum-sheet"><div className="cat">Review items</div><div className="mt-2 text-2xl font-semibold text-[#DCEBF5]">{review.length}</div></div><div className="stratum-sheet"><div className="cat">Critical</div><div className="mt-2 text-2xl font-semibold text-[#E0954F]">{critical.length}</div></div><div className="stratum-sheet"><div className="cat">Verified total</div><div className="mt-2 text-2xl font-semibold text-[#6FD6C9]">{objects.filter(o=>o.verifiedAt).length}</div></div></section>
    <section className="stratum-sheet">{review.length===0?<div className="empty-state">No takeoff objects currently require review.</div>:<div className="table-scroll"><table className="min-w-[1050px]"><thead><tr><th>Object</th><th>Sheet</th><th>Layer</th><th>Type</th><th>Measurement</th><th>Confidence</th><th>Reason</th><th>Action</th></tr></thead><tbody>{review.map(o=>{const rev=revisions.find(r=>r.id===o.drawingRevisionId);const layer=layers.find(l=>l.id===o.layerId);const reasons:string[]=[];if(!o.verifiedAt)reasons.push("Unverified");if((o.confidence??0)<.8)reasons.push("Low confidence");if((o.objectType==="LINEAR"||o.objectType==="AREA")&&!o.calibrationId)reasons.push("No calibration snapshot");return <tr key={o.id}><td className="desc-cell">{o.name}<span className="cat">{o.description||o.source}</span></td><td>{rev?`${rev.sheetNumber} · R${rev.revision}`:"—"}</td><td>{layer?.name||"—"}</td><td>{o.objectType}</td><td className="num">{o.objectType==="COUNT"?o.quantity:(o.measurement??o.quantity)} {o.unit}</td><td>{o.confidence==null?"—":`${Math.round(o.confidence*100)}%`}</td><td><span className={reasons.some(r=>r.includes("No calibration")||r.includes("Low"))?"text-[#E0954F]":"text-[#9CB2C2]"}>{reasons.join(" · ")}</span></td><td>{o.verifiedAt?<span className="text-xs text-[#6FD6C9]">Verified</span>:<form action={verifyTakeoffObjectAction.bind(null,projectId)}><input type="hidden" name="objectId" value={o.id}/><button className="btn small">Verify</button></form>}</td></tr>})}</tbody></table></div>}</section>
  </div>;
}
