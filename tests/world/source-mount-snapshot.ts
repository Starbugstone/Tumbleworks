import { createHash } from 'node:crypto';
import { Box3, Mesh, Object3D, Quaternion, Vector3, type BufferAttribute } from 'three';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { villageWorld } from './village-world-fixture';
const bytes = (a: ArrayBufferView) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const hash = (a: ArrayBufferView) => createHash('sha256').update(bytes(a)).digest('hex');
export function sourceSnapshot(full = false) {
 const begin=performance.now(),f=villageWorld(1,true),constructorMs=performance.now()-begin;
 try {
  const route=f.probe.machine.route;route.requirePhysical();const prefix=(route as unknown as{prefix:unknown}).prefix;
  if(!(prefix instanceof VillageRollingPrefix))throw new Error('Current physical prefix missing');
  const retained=prefix.retained.map(m=>({stop:m.station.stop,inventory:m.inventory,capture:m.capture,opening:m.opening,closing:m.closing,carry:m.carryAudit,ledger:m.physicalLedger,wrenches:m.carriageWrenches,holds:m.carriageHoldBounds,times:[m.start,m.closureStart,m.closureEnd,m.carryStart,m.carryEnd,m.openingEnd,m.end]}));
  const scalars={duration:route.duration,contacts:route.contacts,transfers:route.transfers,segments:route.segments,boundaries:route.boundaries,handoff:route.handoff,ledger:route.physicalLedger,retained};
  const times=new Set([0,route.duration,...route.contacts.flatMap(c=>[c.start,c.contact,c.end]),...route.transfers.flatMap(t=>[t.start,t.end]),...prefix.retained.flatMap(m=>[m.start,m.closureStart,m.closureEnd,m.carryStart,m.carryEnd,m.openingEnd,m.end,...(m.capture?.events.flatMap(e=>[m.start+e.start,m.start+e.end])??[])]),...f.world.filmShots.flatMap(s=>[s.start,s.end])]);
  for(const m of prefix.terminal)for(const t of[m.start,m.end,...m.capture.events.flatMap(e=>[m.start+e.start,m.start+e.end])])times.add(t);
  for(const e of prefix.events)for(const t of[e.cam.drive.contact,e.cam.gateOpen,e.cam.end])if(t<=route.duration)times.add(t);
  if(full)for(let i=0;i<=Math.ceil(route.duration*120);i++)times.add(Math.min(i/120,route.duration));
  const movers=(f.probe.machine as unknown as{movers:{group:Object3D}[]}).movers.map(m=>m.group),p=new Vector3(),n=new Vector3(),q=new Quaternion();
  const poses=[];for(const normal of[true,false])for(const t of[...times].sort((a,b)=>a-b)){
   f.world.film(t,normal);f.world.scene.updateMatrixWorld(true);route.sample(t,p);route.normalAt(t,n);route.marbleOrientation(t,q);
   const h=createHash('sha256');h.update(bytes(new Float64Array([...p.toArray(),...n.toArray(),...q.toArray()])));
   let weight:number[]=[];for(const m of movers){const a=m.matrixWorld.toArray();if(m.name==='village-5-weight'){weight=[...a];a[12]=0;}h.update(m.name);h.update(bytes(new Float64Array(a)));}
   poses.push({normal,t,hash:h.digest('hex'),weight,camera:f.world.camera.matrixWorld.toArray(),projection:f.world.camera.projectionMatrix.toArray()});
  }
  const apply=[];for(let r=0;r<3;r++){const t=performance.now();for(let i=0;i<240;i++)f.probe.machine.apply(route.duration*i/239);apply.push(performance.now()-t);}
  const bounds=new Box3();f.probe.machine.bounds(bounds);return{scalars,poses,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},cost:{constructorMs,apply,workPerRun:240,moverCount:movers.length}};
 }finally{f.dispose();}
}
export function sourceScenes(){return Array.from({length:6},(_,chapter)=>{const f=villageWorld(chapter,true);try{f.world.film(0,true);f.world.scene.updateMatrixWorld(true);const meshes:unknown[]=[];f.world.scene.traverse(o=>{if(o instanceof Mesh)meshes.push({name:o.name,attributes:Object.fromEntries((Object.entries(o.geometry.attributes)as[string,BufferAttribute][]).map(([k,a])=>[k,{count:a.count,itemSize:a.itemSize,hash:hash(a.array)}])),index:o.geometry.index?hash(o.geometry.index.array):null,indexCount:o.geometry.index?.count,local:o.matrix.toArray(),world:o.matrixWorld.toArray()});});return{chapter,plan:f.probe.machine.route.authoredPlan,meshes};}finally{f.dispose();}});}
