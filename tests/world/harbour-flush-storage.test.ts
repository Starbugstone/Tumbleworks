import{BufferGeometry}from'three';import{expect,it}from'vitest';
import{villageScenePlan}from'../../src/world/village-plans';import{pendulumParts}from'../../src/view/pendulum-parts';
import{PendulumSupport,footingHeight}from'../../src/world/pendulum-support';import type{PendulumDrive}from'../../src/world/pendulum-types';

function fixture(old=false){let s=villageScenePlan(0).plan.stations.find(s=>s.stop===1)!;if(old){const d=s.strikerDrive as PendulumDrive;s={...s,anchor:[7.4,1.95,7.5],entry:{...s.entry,position:[6.6,1.95,7.5]},exit:{...s.exit,position:[8.2,1.95,7.5]},strikerDrive:{...d,axle:{...d.axle,origin:[7.1000000000000005,3.55,7.5]},footings:d.footings.map(p=>({...p,z:p.z-5}))}};}
 const d=s.strikerDrive as PendulumDrive,parts=pendulumParts(s,d,(x,z)=>footingHeight(d,x,z));return{s,d,parts,dispose:()=>parts.parts.forEach(p=>p.geometry.dispose())};}
const bounds=(g:BufferGeometry,axis:number)=>{const p=g.getAttribute('position'),a=Array.from({length:p.count},(_,i)=>p.getComponent(i,axis));return[Math.min(...a),Math.max(...a)]as const;};
it('actual Harbour cap/post finite flush enrols after accounting for its two vertical Float32 stores',()=>{const f=fixture();try{expect(()=>PendulumSupport.enrol(f.s,f.d,f.parts)).not.toThrow();}finally{f.dispose();}});
it('old berth stays valid and the independent producing-operation bound admits actual packing only',()=>{const f=fixture(true),n=fixture();try{
 expect(()=>PendulumSupport.enrol(f.s,f.d,f.parts)).not.toThrow();const bottom=Math.fround(.4)-2.7,h=.1-bottom,c=(.1+bottom)/2;
 const packedTop=Math.fround(Math.fround(h/2)+c),capBottom=Math.fround(Math.fround(-.08)+.18),post=n.parts.parts.find(p=>p.id==='frame-post-1')!,cap=n.parts.parts.find(p=>p.id==='frame-cap')!;
 expect(bounds(post.geometry,1)[1]).toBe(packedTop);expect(bounds(cap.geometry,1)[0]).toBe(capBottom);
 expect(Math.abs(packedTop-capBottom)).toBeGreaterThan(2**-24*(.1+.1));
 const producingBound=2**-24*(Math.abs(h/2)+Math.abs(Math.fround(h/2)+c)+.08+Math.abs(Math.fround(-.08)+.18))+64*Number.EPSILON;
 expect(Math.abs(packedTop-capBottom)).toBeLessThanOrEqual(producingBound);
 for(const part of[post,cap]){const p=part.geometry.clone().translate(...n.d.axle.origin);try{expect(part===post?bounds(p,1)[1]:bounds(p,1)[0]).toBe(Math.fround(2.8));}finally{p.dispose();}}
 }finally{f.dispose();n.dispose();}});
it('true 0.5–1 micron face displacement, overhang, missing/nonfinite parts and changed dimensions still reject',()=>{
 const f=fixture();try{const change=(id:string,mutate:(g:BufferGeometry)=>void)=>{const original=f.parts.parts.find(p=>p.id===id)!,g=original.geometry.clone();try{mutate(g);expect(()=>PendulumSupport.enrol(f.s,f.d,{...f.parts,parts:f.parts.parts.map(p=>p===original?{...p,geometry:g}:p)})).toThrow(/striker-bearing-certificate/);}finally{g.dispose();}};
 for(const delta of[-1e-6,-.5e-6,.5e-6,1e-6]){change('frame-post-1',g=>{const p=g.getAttribute('position'),top=bounds(g,1)[1];for(let i=0;i<p.count;i++)if(p.getY(i)===top)p.setY(i,p.getY(i)+delta);});change('frame-cap',g=>g.translate(0,-delta,0));if(delta>0)change('frame-post-1',g=>g.translate(0,0,delta));}
 change('frame-post-1',g=>{const p=g.getAttribute('position');for(let i=0;i<p.count;i++)if(p.getX(i)>0)p.setX(i,.091);});
 change('frame-post-1',g=>g.getAttribute('position').setY(0,Infinity));change('frame-cap',g=>g.scale(1,.9,1));change('frame-post-1',g=>g.getAttribute('position').setY(0,NaN));
 expect(()=>PendulumSupport.enrol(f.s,f.d,{...f.parts,parts:f.parts.parts.filter(p=>p.id!=='frame-cap')})).toThrow();
 }finally{f.dispose();}
});
