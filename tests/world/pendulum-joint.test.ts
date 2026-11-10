import{writeFileSync}from'node:fs';
import{Matrix4,Ray,Vector3}from'three';
import{expect,it}from'vitest';
import{pendulumParts}from'../../src/view/pendulum-parts';
import{villageScenePlan}from'../../src/world/village-plans';
import{compileTerrain,terrainHeightAt}from'../../src/world/village-terrain';

it('raw Mill journal facet gap stays real and separate from the declared nominal bearing',()=>{
 const station=villageScenePlan(2).plan.stations.find(s=>s.stop===7)!,d=station.strikerDrive!;if(d.kind!=='pendulum')throw new Error('new drive required');
 const terrain=compileTerrain(villageScenePlan(2).terrain),parts=pendulumParts(station,d,(x,z)=>terrainHeightAt(terrain,x,z));
 try{
  const shaft=parts.parts.find(p=>p.id==='fixed-axle')!,hub=parts.parts.find(p=>p.id==='hammer-hub')!;
  const nearest=(g:typeof shaft.geometry,rotation:number,angle:number)=>{
   const p=g.getAttribute('position'),ix=g.index,m=new Matrix4().makeRotationZ(rotation),ray=new Ray(new Vector3(0,0,-.36),new Vector3(Math.cos(angle),Math.sin(angle),0)),hit=new Vector3();let best=Infinity;
   for(let i=0;i<(ix?.count??p.count);i+=3){const v=[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(m));if(ray.intersectTriangle(v[0]!,v[1]!,v[2]!,false,hit))best=Math.min(best,hit.distanceTo(ray.origin));}
   return best;
  };
  const rows=[0,Math.PI/32,Math.PI/16,.35,.7].map(q=>({q,rays:Array.from({length:32},(_,i)=>{const angle=.01+2*Math.PI*i/32,s=nearest(shaft.geometry,0,angle),b=nearest(hub.geometry,q,angle);return{angle,shaft:s,bore:b,gap:b-s};})}));
  const error=2**-24*Math.sqrt(3)*.055+64*Number.EPSILON;
  writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/mill-journal-gap.json',JSON.stringify({kind:'actual packed ray witness; ideal centred reaction NOT certified by this report',axial:[-.42,-.3],error,rows},null,2));
  // Acceptance condition deliberately remains red if every radial direction is
  // separated. No same-body or declared-name exception closes a physical gap.
  expect(rows.every(r=>r.rays.every(a=>Number.isFinite(a.gap)))).toBe(true);
  expect(Math.min(...rows[0]!.rays.map(r=>r.gap))).toBeGreaterThan(80000*error);
 }finally{parts.parts.forEach(p=>p.geometry.dispose());}
});
