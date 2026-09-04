type Point={x:number;y:number};
export type MatchableSpatial={id:string;name:string;objectType:string;layerId:string|null;quantity:number;measurement:number|null;geometryJson:unknown};
export type SpatialMatch={previous:MatchableSpatial;current:MatchableSpatial;classification:"UNCHANGED"|"MOVED"|"RESIZED"|"MOVED_RESIZED";confidence:number;measureDelta:number;centroidDistance:number};

function norm(s:string){return s.trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function pts(g:unknown):Point[]{if(!g||typeof g!=="object")return[];const x=g as{type?:string;x?:unknown;y?:unknown;points?:unknown};if(x.type==="Point"&&typeof x.x==="number"&&typeof x.y==="number")return[{x:x.x,y:x.y}];if(Array.isArray(x.points))return x.points.flatMap(p=>p&&typeof p==="object"&&typeof(p as Point).x==="number"&&typeof(p as Point).y==="number"?[p as Point]:[]);return[];}
function centroid(o:MatchableSpatial){const p=pts(o.geometryJson);if(!p.length)return{x:0,y:0};return{x:p.reduce((n,v)=>n+v.x,0)/p.length,y:p.reduce((n,v)=>n+v.y,0)/p.length};}
function measure(o:MatchableSpatial){return o.objectType==="COUNT"?o.quantity:(o.measurement??o.quantity);}
function words(s:string){return new Set(norm(s).split(" ").filter(Boolean));}
function nameSimilarity(a:string,b:string){const A=words(a),B=words(b);if(!A.size&&!B.size)return 1;const overlap=[...A].filter(x=>B.has(x)).length;const union=new Set([...A,...B]).size;return union?overlap/union:0;}
function score(a:MatchableSpatial,b:MatchableSpatial){if(a.objectType!==b.objectType)return-1;if((a.layerId||"")!==(b.layerId||""))return-1;const ca=centroid(a),cb=centroid(b);const dist=Math.hypot(ca.x-cb.x,ca.y-cb.y);const ma=Math.max(Math.abs(measure(a)),1e-9),mb=Math.max(Math.abs(measure(b)),1e-9);const ratio=Math.min(ma,mb)/Math.max(ma,mb);const name=nameSimilarity(a.name,b.name);const distanceScore=1/(1+dist/50);return name*.5+ratio*.3+distanceScore*.2;}

export function matchSpatialRevisions(previous:MatchableSpatial[],current:MatchableSpatial[]){
  const candidates: Array<{p:MatchableSpatial;c:MatchableSpatial;score:number}> = [];
  for(const p of previous)for(const c of current){const s=score(p,c);if(s>=.48)candidates.push({p,c,score:s});}
  candidates.sort((a,b)=>b.score-a.score);
  const usedP=new Set<string>(),usedC=new Set<string>(),matches:SpatialMatch[]=[];
  for(const x of candidates){if(usedP.has(x.p.id)||usedC.has(x.c.id))continue;usedP.add(x.p.id);usedC.add(x.c.id);const cp=centroid(x.p),cc=centroid(x.c);const d=Math.hypot(cp.x-cc.x,cp.y-cc.y);const before=measure(x.p),after=measure(x.c),delta=after-before;const measureChanged=Math.abs(delta)>Math.max(.0001,Math.abs(before)*.01);const moved=d>2;const classification=moved&&measureChanged?"MOVED_RESIZED":moved?"MOVED":measureChanged?"RESIZED":"UNCHANGED";matches.push({previous:x.p,current:x.c,classification,confidence:Math.min(.99,Math.max(.5,x.score)),measureDelta:delta,centroidDistance:d});}
  return {matches,added:current.filter(x=>!usedC.has(x.id)),removed:previous.filter(x=>!usedP.has(x.id))};
}
