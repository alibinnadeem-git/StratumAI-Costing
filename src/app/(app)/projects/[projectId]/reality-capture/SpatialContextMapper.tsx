"use client";

import { useMemo, useState } from "react";
import PdfPageSurface, { type Geometry, type Point } from "../drawings/markup/PdfPageSurface";
import { createSpatialContextLinkAction } from "./actions";

type Revision={id:string;sheetNumber:string;sheetTitle:string|null;revision:string;externalUrl:string|null;sourcePageNumber:number|null;rotationDegrees:number|null};
type Space={id:string;name:string};
type PoseSource={id:string;title:string;realityCaptureSpaceId:string|null;matterportPoseJson:unknown};

type Props={projectId:string;revisions:Revision[];spaces:Space[];poseSources:PoseSource[];defaultSpaceId?:string};

export default function SpatialContextMapper({projectId,revisions,spaces,poseSources,defaultSpaceId}:Props){
  const [spaceId,setSpaceId]=useState(defaultSpaceId&&spaces.some(s=>s.id===defaultSpaceId)?defaultSpaceId:(spaces[0]?.id||""));
  const [revisionId,setRevisionId]=useState(revisions[0]?.id||"");
  const [poseId,setPoseId]=useState("");
  const [start,setStart]=useState<Point|null>(null);
  const [region,setRegion]=useState<Geometry|null>(null);
  const revision=revisions.find(r=>r.id===revisionId)||null;
  const eligiblePoses=useMemo(()=>poseSources.filter(p=>p.realityCaptureSpaceId===spaceId&&p.matterportPoseJson),[poseSources,spaceId]);
  const pose=eligiblePoses.find(p=>p.id===poseId)?.matterportPoseJson??null;
  function place(p:Point){if(!start){setStart(p);setRegion(null);return;}setRegion({type:"Rectangle",x1:start.x,y1:start.y,x2:p.x,y2:p.y});setStart(null);}
  const action=createSpatialContextLinkAction.bind(null,projectId);
  return <section className="stratum-sheet">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#DCEBF5]">Matterport viewpoint ↔ drawing region</h2><p className="cat mt-1">Choose a saved Matterport viewpoint, then mark the exact normalized region on its controlled drawing revision.</p></div>{region&&<span className="tag REF">REGION READY</span>}</div>
    <div className="mt-3 grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-3">
        <label className="block"><span className="cat">Reality capture</span><select value={spaceId} onChange={e=>{setSpaceId(e.target.value);setPoseId("");}} className="mt-1 w-full min-h-11">{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block"><span className="cat">Saved Matterport viewpoint</span><select value={poseId} onChange={e=>setPoseId(e.target.value)} className="mt-1 w-full min-h-11"><option value="">No viewpoint selected</option>{eligiblePoses.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label className="block"><span className="cat">Drawing revision</span><select value={revisionId} onChange={e=>{setRevisionId(e.target.value);setStart(null);setRegion(null);}} className="mt-1 w-full min-h-11">{revisions.map(r=><option key={r.id} value={r.id}>{r.sheetNumber} · R{r.revision} · {r.sheetTitle||"Untitled"}</option>)}</select></label>
        <div className="rounded border border-[#1C3A57] bg-[#0B1F32] p-3 text-xs text-[#9CB2C2]">Tap two corners on the drawing to define the field-of-interest rectangle. The saved coordinates remain normalized to the controlled sheet.</div>
        <form action={action} className="space-y-2">
          <input type="hidden" name="realityCaptureSpaceId" value={spaceId}/><input type="hidden" name="drawingRevisionId" value={revisionId}/><input type="hidden" name="drawingGeometryJson" value={region?JSON.stringify(region):""}/><input type="hidden" name="matterportPoseJson" value={pose?JSON.stringify(pose):""}/>
          <input name="label" required placeholder="Electrical room / switchgear / area" className="w-full min-h-11"/>
          <button className="btn w-full min-h-12" disabled={!region||!revisionId||!spaceId}>Save spatial cross-link</button>
          <div className="cat">{pose?"Viewpoint attached":"Region-only link"} · {region?"Drawing region attached":"Select region"}</div>
        </form>
      </div>
      <div>{revision?<PdfPageSurface url={revision.externalUrl} pageNumber={revision.sourcePageNumber||1} initialRotation={((revision.rotationDegrees||0)%360) as 0|90|180|270} interactive onPoint={place} marks={[]} onSelect={()=>{}} draft={region} start={start}/>:<div className="empty-state">No drawing revision available.</div>}</div>
    </div>
  </section>;
}
