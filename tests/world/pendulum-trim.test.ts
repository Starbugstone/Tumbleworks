import{BufferGeometry,Float32BufferAttribute,Mesh,Ray,Vector3}from'three';
import{expect,it}from'vitest';
import{pendulumParts,pendulumRenderGeometry}from'../../src/view/pendulum-parts';
import{pendulumStation}from'./pendulum-fixture';
import{proposedPendulum}from'./pendulum-fields';
import{surfaceTriangles}from'./surface-overlap';
it('render weld trim preserves the exact exposed union and rejects an exposed-face mutant',()=>{
 const d=proposedPendulum({...pendulumStation,strikerDrive:{mass:.001,inertia:.000095,friction:.008,stroke:.5}},'harbour-bell',()=>0),parts=pendulumParts(pendulumStation,d,()=>0),arm=parts.parts.find(p=>p.id==='hammer-arm')!,cover=parts.parts.find(p=>p.id==='bar-return')!,before=Array.from(arm.geometry.getAttribute('position').array),trim=pendulumRenderGeometry(arm,parts);
 try{
  expect(Array.from(arm.geometry.getAttribute('position').array)).toEqual(before);expect(parts.axleInertia).toBe(.0014463873893668683);
  const distance=(g:readonly BufferGeometry[],y:number,z:number)=>{const ray=new Ray(new Vector3(1,y,z),new Vector3(-1,0,0)),hit=new Vector3();let result=Infinity;for(const geometry of g)for(const t of surfaceTriangles(new Mesh(geometry)))if(ray.intersectTriangle(t.a,t.b,t.c,false,hit))result=Math.min(result,hit.distanceTo(ray.origin));return result;};
  for(const y of[-1.55,-1.54,-1.53,-1.51,-1.3,-.2])for(const z of[-.385,-.37,-.35,-.335])expect(Math.abs(distance([trim,cover.geometry],y,z)-distance([arm.geometry,cover.geometry],y,z))).toBeLessThan(128*Number.EPSILON);
  const p=cover.geometry.getAttribute('position'),ix=cover.geometry.index,positions:number[]=[];
  for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(j=>ix?ix.getX(i+j):i+j);if(ids.every(j=>p.getX(j)>.019))continue;for(const j of ids)positions.push(p.getX(j),p.getY(j),p.getZ(j));}
  const mutant=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));
  try{expect(distance([trim,mutant],-1.54,-.35)-distance([arm.geometry,cover.geometry],-1.54,-.35)).toBeGreaterThan(.01);}finally{mutant.dispose();}
  expect(()=>pendulumRenderGeometry(arm,{...parts,parts:parts.parts.map(p=>p===cover?{...p,body:'fixed'}:p)})).toThrow(/rigid return/);
 }finally{trim.dispose();parts.parts.forEach(p=>p.geometry.dispose());}
});
