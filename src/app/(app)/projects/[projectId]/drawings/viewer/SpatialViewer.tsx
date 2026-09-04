"use client";

import { useMemo, useState } from "react";

type Revision={id:string;sheetNumber:string;sheetTitle:string|null;revision:string;externalUrl:string|null;scaleLabel:string|null;width:number|null;height:number|null};
type Layer={id:string;name:string;category:string;isVisibleDefault:boolean};
type Obj={id:string;drawingRevisionId:string;layerId:string|null;objectType:string;name:string;description:string|null;quantity:number;unit:string;measurement:number|null;geometryJson:unknown;verifiedAt:string|null};
type CostLink={spatialObjectId:string;estimateLineId:string;description:string;estimateNumber:number;quantityBasis:number|null};

type Point={x:number;y:number};
function pointsFrom(g:unknown):Point[]{
  if(!g||typeof g!=="object")return [];
  const x=g as {type?:string;x?:unknown;y?:unknown;points?:unknown};
  if(x.type==="Point"&&typeof x.x==="number"&&typeof x.y==="number")return [{x:x.x,y:x.y}];
  if(Array.isArray(x.points))return x.points.flatMap(p=>p&&typeof p==="object"&&typeof (p as Point).x==="number"&&typeof (p as Point).y==="number"?[p as Point]:[]);
  return [];
}

export default function SpatialViewer({revisions,layers,objects,costLinks}:{revisions:Revision[];layers:Layer[];objects:Obj[];costLinks:CostLink[]}){
  const [revisionId,setRevisionId]=useState(revisions[0]?.id||"");
  const [visible,setVisible]=useState<Set<string>>(()=>new Set(layers.filter(l=>l.isVisibleDefault).map(l=>l.id)));
  const [selected,setSelected]=useState<string|null>(null);
  const [zoom,setZoom]=useState(1);
  const rev=revisions.find(r=>r.id===revisionId);
  const shown=useMemo(()=>objects.filter(o=>o.drawingRevisionId===revisionId&&(!o.layerId||visible.has(o.layerId))),[objects,revisionId,visible]);
  const allPts=shown.flatMap(o=>pointsFrom(o.geometryJson));
  const minX=Math.min(0,...allPts.map(p=>p.x)), minY=Math.min(0,...allPts.map(p=>p.y));
  const maxX=Math.max(rev?.width||100,...allPts.map(p=>p.x),100), maxY=Math.max(rev?.height||100,...allPts.map(p=>p.y),100);
  const pad=Math.max(5,(Math.max(maxX-minX,maxY-minY))*0.05); const vw=maxX-minX+pad*2; const vh=maxY-minY+pad*2;
  const active=objects.find(o=>o.id===selected)||null; const activeLinks=costLinks.filter(l=>l.spatialObjectId===selected);
  function toggleLayer(id:string){setVisible(prev=>{const next=new Set(prev); next.has(id)?next.delete(id):next.add(id); return next;});}
  return <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
    <aside className="stratum-sheet h-fit space-y-4"><div><div className="cat">Sheet / revision</div><select className="mt-1 w-full" value={revisionId} onChange={e=>{setRevisionId(e.target.value);setSelected(null);}}>{revisions.map(r=><option key={r.id} value={r.id}>{r.sheetNumber} · R{r.revision}</option>)}</select></div><div><div className="cat">Layers</div><div className="mt-2 space-y-2">{layers.map(l=><label key={l.id} className="flex items-center gap-2 text-xs text-[#DCEBF5]"><input type="checkbox" checked={visible.has(l.id)} onChange={()=>toggleLayer(l.id)}/><span>{l.name}</span><span className="ml-auto font-mono text-[9px] text-[#6D8AA0]">{l.category}</span></label>)}</div></div><div><div className="cat">Zoom</div><div className="mt-2 flex gap-2"><button className="btn small" onClick={()=>setZoom(z=>Math.max(.5,z-.25))}>−</button><div className="min-w-16 self-center text-center font-mono text-xs text-[#9CB2C2]">{Math.round(zoom*100)}%</div><button className="btn small" onClick={()=>setZoom(z=>Math.min(4,z+.25))}>+</button></div></div>{rev?.externalUrl&&<a href={rev.externalUrl} target="_blank" rel="noreferrer" className="btn-secondary block text-center">Open source drawing</a>}</aside>

    <section className="stratum-sheet overflow-hidden"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-[#DCEBF5]">{rev?`${rev.sheetNumber} · ${rev.sheetTitle||"Untitled"}`:"No sheet"}</h2><p className="cat">{rev?`Rev ${rev.revision}${rev.scaleLabel?` · ${rev.scaleLabel}`:""}`:"Register a drawing revision first"}</p></div><div className="cat">{shown.length} visible object{shown.length===1?"":"s"}</div></div>{!rev?<div className="empty-state">No drawing revisions available.</div>:<div className="overflow-auto border border-[#1C3A57] bg-[#07131D]" style={{maxHeight:"72vh"}}><div style={{width:`${zoom*100}%`,minWidth:"100%"}}><svg viewBox={`${minX-pad} ${minY-pad} ${vw} ${vh}`} className="block h-auto w-full" role="img" aria-label="Spatial takeoff drawing overlay"><rect x={minX-pad} y={minY-pad} width={vw} height={vh} fill="transparent" stroke="currentColor" className="text-[#183247]"/>{shown.map(o=>{const pts=pointsFrom(o.geometryJson); const isActive=o.id===selected; const cls=isActive?"text-[#E0954F]":"text-[#6FD6C9]"; if(o.objectType==="COUNT"&&pts[0])return <g key={o.id} onClick={()=>setSelected(o.id)} className={`${cls} cursor-pointer`}><circle cx={pts[0].x} cy={pts[0].y} r={Math.max(vw,vh)*0.012} fill="currentColor"/><text x={pts[0].x+Math.max(vw,vh)*0.015} y={pts[0].y} fontSize={Math.max(vw,vh)*0.018} fill="currentColor">{o.name}</text></g>; if(o.objectType==="LINEAR"&&pts.length>=2)return <polyline key={o.id} points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={Math.max(vw,vh)*0.008} className={`${cls} cursor-pointer`} onClick={()=>setSelected(o.id)}/>; if(o.objectType==="AREA"&&pts.length>=3)return <polygon key={o.id} points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="currentColor" fillOpacity={isActive?.32:.14} stroke="currentColor" strokeWidth={Math.max(vw,vh)*0.006} className={`${cls} cursor-pointer`} onClick={()=>setSelected(o.id)}/>; return null;})}</svg></div></div>}</section>

    <aside className="stratum-sheet h-fit">{!active?<div className="empty-state">Select a takeoff object on the drawing.</div>:<div className="space-y-4"><div><div className="cat">Selected object</div><h3 className="mt-1 text-sm font-semibold text-[#DCEBF5]">{active.name}</h3><p className="mt-1 text-xs text-[#9CB2C2]">{active.description||"No description"}</p></div><div className="grid grid-cols-2 gap-3"><div><div className="cat">Type</div><div className="mt-1 text-sm text-[#DCEBF5]">{active.objectType}</div></div><div><div className="cat">Quantity</div><div className="mt-1 font-mono text-sm text-[#6FD6C9]">{active.objectType==="COUNT"?active.quantity:(active.measurement??active.quantity)} {active.unit}</div></div><div><div className="cat">Layer</div><div className="mt-1 text-xs text-[#DCEBF5]">{layers.find(l=>l.id===active.layerId)?.name||"—"}</div></div><div><div className="cat">Status</div><div className="mt-1 text-xs text-[#DCEBF5]">{active.verifiedAt?"VERIFIED":"UNVERIFIED"}</div></div></div><div><div className="cat">Commercial trace</div><div className="mt-2 space-y-2">{activeLinks.map(l=><div key={l.estimateLineId} className="border border-[#1C3A57] p-2 text-xs"><div className="font-semibold text-[#DCEBF5]">EST-{String(l.estimateNumber).padStart(4,"0")}</div><div className="text-[#9CB2C2]">{l.description}</div><div className="cat">Basis {l.quantityBasis??"—"}</div></div>)}{activeLinks.length===0&&<div className="cat">Not linked to estimate scope yet.</div>}</div></div></div>}</aside>
  </div>;
}
