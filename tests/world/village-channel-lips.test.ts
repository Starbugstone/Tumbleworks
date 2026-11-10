import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { createHash } from 'node:crypto';
import { villageArc, villageChannelGeometry } from '../../src/view/machine-primitives';
import { surfaceTriangles } from './surface-overlap';
import { contactRayHits, contactSectionRadius } from './active-retainer-floors';
import { trimChannelLip } from '../../src/view/village-channel-lips';
import { villagePort, type VillageChannelLip } from '../../src/world/village-plan';
import { VillageMachine } from '../../src/view/village-machine';
import { villageScenePlan } from '../../src/world/village-plans';
import { villageWorld } from './village-world-fixture';

const frames = () => villageArc([0,0,0],10,-Math.PI/2,.2,[1,0,0],[0,0,1],0,32);
const lip: VillageChannelLip = {side:'positive',minimumHeight:.17,envelopes:[{startFrame:7,fullStartFrame:15,fullEndFrame:16,endFrame:24}]};
const options = (metadata=lip,protectedOriginalFrames:readonly number[]=[]) => ({lip:metadata,staticFloor:true as const,protectedOriginalFrames});

describe('static terracotta channel lip construction contract',()=>{
 it.each(['plank','timber','girder','steel','twinrail']as const)('rejects wrong profile %s',profile=>{
  expect(()=>villageChannelGeometry(frames(),profile,undefined,false,options())).toThrow('static terracotta');
 });
 it.each(['side','invalid-side','range','fade','height','pad','docking','compressed','foreign','underheight-buffer','indices','moving']as const)('rejects %s without changing guards or accepting foreign buffers',mutant=>{
  const p=frames();
  switch(mutant){
   case'side':expect(()=>villageChannelGeometry(p,'terracotta',undefined,false,options({...lip,side:'negative'}))).toThrow('positive z');break;
   case'invalid-side':expect(()=>villageChannelGeometry(p,'terracotta',undefined,false,options({...lip,side:'unknown' as VillageChannelLip['side']}))).toThrow('explicit side');break;
   case'range':expect(()=>villageChannelGeometry(p,'terracotta',undefined,false,options({...lip,envelopes:[{startFrame:7,fullStartFrame:15,fullEndFrame:16,endFrame:40}]}))).toThrow('envelope');break;
   case'fade':expect(()=>villageChannelGeometry(p,'terracotta',undefined,false,options({...lip,envelopes:[{startFrame:8,fullStartFrame:15,fullEndFrame:16,endFrame:24}]}))).toThrow('eight');break;
   case'height':expect(()=>villageChannelGeometry(p,'terracotta',undefined,false,options({...lip,minimumHeight:.169999}))).toThrow('height');break;
   case'pad':expect(()=>villageChannelGeometry(p,'terracotta',undefined,false,options(lip,[15]))).toThrow('protected pad');break;
   case'docking':expect(()=>villageChannelGeometry(p,'terracotta',{},false,options())).toThrow('without docking');break;
   case'compressed':expect(()=>villageChannelGeometry(Array.from({length:33},(_,i)=>villagePort([i,0,0])),'terracotta',undefined,false,options())).toThrow('eight');break;
   case'foreign':{const g=new BoxGeometry();try{expect(()=>trimChannelLip(g,p,p.map((_,i)=>i),p.length,options(),false)).toThrow('foreign');}finally{g.dispose();}break;}
   case'underheight-buffer':{const g=villageChannelGeometry(p,'terracotta');try{g.getAttribute('position').setY(15*12+2,-.14);expect(()=>trimChannelLip(g,p,p.map((_,i)=>i),p.length,options(),false)).toThrow('foreign profile vertices');}finally{g.dispose();}break;}
   case'indices':{const g=villageChannelGeometry(p,'terracotta');try{g.index!.setX(0,1);expect(()=>trimChannelLip(g,p,p.map((_,i)=>i),p.length,options(),false)).toThrow('indices');}finally{g.dispose();}break;}
   case'moving':{const plan=villageScenePlan(1).plan,material=new MeshStandardMaterial();try{expect(()=>new VillageMachine({...plan,stations:plan.stations.map(s=>s.stop===9?{...s,channelLip:lip}:s)},{model:()=>new Group()},material,()=>0)).toThrow('moving floor');}finally{material.dispose();}break;}
  }
 });
 it('recomputes finite unit normals from actual changed positions and preserves exact selected copy positions/indices',()=>{
  const f=villageWorld(1,true);
  try{
   for(const name of['village-track-arc-3','village-track-bowl-0']){
    const mesh=f.world.scene.getObjectByName(name);expect(mesh).toBeInstanceOf(Mesh);if(!(mesh instanceof Mesh))throw new Error('Actual mesh missing');
    // Independently selected maximal legal cap copies, checked before live wiring.
    const selected=name==='village-track-arc-3'?['7785a6c221d60cfbc39741d3b09988cb2c48c02b4b62e9439b45f9ecf4dedac0','70379a178ebd2b220c2879621d775556e491956d6c323b44d589f774d2e83a4f']:['8e68353c017614df5a4116a7794f06c3fa552bf94d17eae9065c05769bb6b1b9','5624f7a05e6b94222ff45d30e8a73a1917a20dd7c1301a9547a951153f8b3fe6'];
    const hash=(array:ArrayBufferView)=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
    expect([hash(mesh.geometry.getAttribute('position').array),hash(mesh.geometry.index!.array)]).toEqual(selected);
    const rebuilt=mesh.geometry.clone();try{rebuilt.deleteAttribute('normal');rebuilt.computeVertexNormals();expect(mesh.geometry.getAttribute('normal').array).toEqual(rebuilt.getAttribute('normal').array);}finally{rebuilt.dispose();}
    const normal=mesh.geometry.getAttribute('normal');for(let i=0;i<normal.count;i++){const n=new Vector3().fromBufferAttribute(normal,i);expect(n.toArray().every(Number.isFinite)).toBe(true);expect(Math.abs(n.length()-1)).toBeLessThan(5*2**-24);}
   }
  }finally{f.dispose();}
 });
 it('keeps actual floor/farwall/pad indices and positions, bounds top-facet interiors above local floor and preserves outward orientation',()=>{
  const f=villageWorld(1,true);try{for(const stop of[3,0]){
   const station=f.probe.plan.stations.find(s=>s.stop===stop)!;if(!('points'in station.mechanism)||!station.channelLip)throw new Error('Actual static lip station required');
   const frames=station.mechanism.points,name=`village-track-${station.mechanism.kind}-${stop}`,mesh=f.world.scene.getObjectByName(name);if(!(mesh instanceof Mesh))throw new Error('Missing physical mesh');
   const before=villageChannelGeometry(frames,'terracotta',undefined,stop===0),after=mesh.geometry;
   try{expect(after.index!.array).toEqual(before.index!.array);expect(after.getAttribute('position').count).toBe(before.getAttribute('position').count);
    const a=after.getAttribute('position'),b=before.getAttribute('position'),index=after.index!,at=(id:number)=>new Vector3().fromBufferAttribute(a,id),was=(id:number)=>new Vector3().fromBufferAttribute(b,id);
    const changed:number[]=[];for(let id=0;id<a.count;id++)if(!at(id).equals(was(id))){changed.push(id);expect(id%12>=1&&id%12<=3&&id<frames.length*12).toBe(true);}expect(changed.length).toBe(stop===3?66:132);
    if(stop===0)for(let ring=frames.length-2;ring<frames.length;ring++)for(let j=0;j<12;j++)expect(at(ring*12+j).toArray()).toEqual(was(ring*12+j).toArray());
    const normals=after.getAttribute('normal');
    for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],p=ids.map(at),q=ids.map(was),n=p[1]!.clone().sub(p[0]!).cross(p[2]!.clone().sub(p[0]!)),old=q[1]!.clone().sub(q[0]!).cross(q[2]!.clone().sub(q[0]!));
     expect(n.lengthSq()).toBeGreaterThan(0);expect(n.dot(old)).toBeGreaterThan(0);
     for(const id of ids)expect(new Vector3().fromBufferAttribute(normals,id).dot(n)).toBeGreaterThan(0);
     if(ids.some(id=>id>=frames.length*12)||!ids.every(id=>[1,2,3].includes(id%12)))continue;
     const span=Math.min(...ids.map(id=>Math.floor(id/12))),floors=[];
     for(let k=0;k<index.count;k+=3){const fs=[index.getX(k),index.getX(k+1),index.getX(k+2)];if(fs.every(id=>id>=frames.length*12||[0,11].includes(id%12))&&fs.some(id=>Math.floor(id/12)===span)&&fs.some(id=>Math.floor(id/12)===span+1))floors.push(fs);}
     expect(floors.length).toBeGreaterThanOrEqual(2);
     for(const fs of floors){const fp=at(fs[0]!),fn=at(fs[1]!).sub(fp).cross(at(fs[2]!).sub(fp)).normalize();if(fn.dot(new Vector3(...frames[span]!.normal))<0)fn.negate();
      // Affine signed plane distance: testing triangle vertices bounds EVERY interior barycentric point.
      for(const vertex of p)expect(vertex.clone().sub(fp).dot(fn)).toBeGreaterThanOrEqual(.17);
     }
    }
   }finally{before.dispose();}
  }}finally{f.dispose();}
 });
 it('uses eight existing frame steps with smooth end derivatives, independently of authored frame spacing',()=>{
  const p=Array.from({length:33},(_,i)=>villagePort([i*.1,0,i*i*.001],[1,0,i*.02],[0,1,0]));
  const before=villageChannelGeometry(p,'terracotta'),after=villageChannelGeometry(p,'terracotta',undefined,false,options());
  try{const b=before.getAttribute('position'),a=after.getAttribute('position'),ease=(u:number)=>u*u*(3-2*u);
   for(let ring=7;ring<=24;ring++){const w=ring<15?ease((ring-7)/8):ring>16?ease((24-ring)/8):1;
    const source=b.getY(ring*12+9),pad=6*2**-24*Math.max(1,...Array.from(b.array,Math.abs));
    expect(a.getY(ring*12+9)).toBe(Math.fround(source+(b.getY(ring*12)+.17+pad-source)*w));
   }
   expect(a.getY(7*12+9)).toBe(b.getY(7*12+9));expect(a.getY(24*12+9)).toBe(b.getY(24*12+9));
  }finally{before.dispose();after.dispose();}
 });

});

const fixtures=[{"time": 22.686199441833196, "stop": 3, "ray": 12}, {"time": 31.08109262735737, "stop": 0, "ray": 12}];
it('rejects restored old-wall visibility and a separate foreign blocker under the unchanged raw ray guard',()=>{
 const f=villageWorld(1,true);try{f.resize(375,690);for(const{time,stop,ray}of fixtures){
  f.world.film(time,true);const route=f.probe.machine.route,center=new Vector3(),tangent=new Vector3(),previous=new Vector3();route.sample(time,center);route.sample(Math.min(route.duration,time+.0001),tangent);route.sample(Math.max(0,time-.0001),previous);tangent.sub(previous).normalize();
  const station=f.probe.plan.stations.find(s=>s.stop===stop)!;if(!('points'in station.mechanism))throw new Error('Static track required');
  const name=`village-track-${station.mechanism.kind}-${stop}`,mesh=f.world.scene.getObjectByName(name);if(!(mesh instanceof Mesh))throw new Error('Current mesh missing');
  const view=center.clone().sub(f.world.camera.position),distance=view.length();view.normalize();const right=view.clone().cross(f.world.camera.up).normalize(),up=right.clone().cross(view).normalize(),radius=.3*Math.sqrt(1-.3**2/distance**2);
  const target=center.clone().addScaledVector(view,-(.3**2)/distance).addScaledVector(right,radius*Math.cos(ray*Math.PI/8)).addScaledVector(up,radius*Math.sin(ray*Math.PI/8));
  const names=new Set([name]),section=contactSectionRadius('terracotta',station.entry.width),original=villageChannelGeometry(station.mechanism.points,'terracotta',undefined,stop===0),old=new Mesh(original,mesh.material);
  old.matrixAutoUpdate=false;old.matrix.copy(mesh.matrixWorld);old.name=name;
  const block=new Mesh(new BoxGeometry(.04,.04,.04),mesh.material);block.name='foreign-visibility-mutant';block.position.copy(target).lerp(f.world.camera.position,.1);
  try{expect(contactRayHits(f.world.camera,target,center,tangent,surfaceTriangles(old),names,section,false).foreign.length).toBeGreaterThan(0);
   expect(contactRayHits(f.world.camera,target,center,tangent,surfaceTriangles(mesh),names,section,false).foreign).toEqual([]);
   expect(contactRayHits(f.world.camera,target,center,tangent,surfaceTriangles(block),names,section,false).foreign.length).toBeGreaterThan(0);
  }finally{original.dispose();block.geometry.dispose();}
 }}finally{f.dispose();}
});
