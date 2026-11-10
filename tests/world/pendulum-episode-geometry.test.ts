// UNUSED / UNRUN. Actual consumer first; no manufactured episode/captured pose.
import{writeFileSync}from'node:fs';
import{Mesh,Triangle,Vector3,Box3,Matrix4}from'three';
import{expect,it}from'vitest';
import{VillageRollingPrefix}from'../../src/world/village-prefix';
import{villageScenePlan}from'../../src/world/village-plans';
import{villageWorld}from'./village-world-fixture';
import{surfaceTriangles}from'./surface-overlap';
import{solidProbes,visible,exposedOverlaps}from'./village-geometry';
import{compileTerrain,cellDiagonal,terrainVertex}from'../../src/world/village-terrain';
import{actualFootPatch}from'./pendulum-feet';
import type{SurfaceTriangle}from'./surface-overlap';
import{pendulumParts}from'../../src/view/pendulum-parts';
import{footingHeight}from'../../src/world/pendulum-support';
import{pendulumPackedBounds,pendulumIntersection,pendulumCrossings}from'./pendulum-proof-geometry';
it('actual Mill striker interval including episodes, bell and actor rest clears ALL scene solids',()=>{
 const scene=villageScenePlan(2),prefix=new VillageRollingPrefix(scene.plan),motion=prefix.strikes.find(s=>s.stop===7)?.motion;
 expect(motion,JSON.stringify(prefix.failure)).toBeDefined();if(!motion)throw new Error('Actual episode consumer required');
 expect(Math.max(motion.end,motion.actorEnd),'No authored tail may manufacture a sphere for physical geometry acceptance').toBeLessThanOrEqual(prefix.end);
 const f=villageWorld(2,true),times=new Set([motion.contact,motion.end,motion.bellTime,motion.actorEnd]);
 for(const e of motion.sequence.episodes){if(e.kind==='impact')times.add(motion.contact+e.state.time);else if(e.kind==='contact'){times.add(motion.contact+e.start);times.add(motion.contact+e.end);for(const event of e.motion.events)for(const t of event.time)times.add(motion.contact+t);}else{times.add(motion.contact+e.start);times.add(motion.contact+e.end);for(let i=0;i<e.motion.rows.length;i+=4)if(motion.sequence.partition.cells.some(c=>c.q0===e.motion.rows[i+1]||c.q1===e.motion.rows[i+1]))times.add(motion.contact+e.motion.rows[i]!);}}
 for(let i=Math.floor(motion.contact*120);i<=Math.ceil(Math.max(motion.end,motion.actorEnd)*120);i++)times.add(i/120);
 const reports:unknown[]=[];let complete=false;
 try{
  const marble=new Vector3(),triangle=new Triangle(),closest=new Vector3(),bounds=new Box3(),machine=f.probe.machine,bar=machine.root.getObjectByName('village-pendulum-7-striking-bar')as Mesh;
  expect(bar).toBeInstanceOf(Mesh);expect(machine.root.getObjectByName('village-7-striker')).toBeDefined();
  const packed=bar.geometry.getAttribute('position'),barSupport=Math.max(...Array.from({length:packed.count},(_,i)=>packed.getX(i)));
  // Explicit approved ideal ground welds: exact provider triangle identity,
  // actual bottom rectangle, storage lineage and finite intersection endpoints.
  const terrain=compileTerrain(scene.terrain),keys=new Set<string>(),key=(p:readonly Vector3[])=>p.map(v=>v.toArray().map(Math.fround).join('/')).sort().join('|'),frameInverse=new Matrix4().copy(machine.root.matrixWorld).invert(),anchors=new Map<string,{bounds:Box3;ground:number;bottom:number}>();
  for(let row=0;row<terrain.rows;row++)for(let col=0;col<terrain.columns;col++)if(terrain.cells[row*terrain.columns+col]==='land'){const v=[terrainVertex(terrain,col,row),terrainVertex(terrain,col+1,row),terrainVertex(terrain,col,row+1),terrainVertex(terrain,col+1,row+1)].map(p=>new Vector3(...p.map(Math.fround)as[number,number,number]));for(const ids of cellDiagonal(col,row)==='main'?[[0,1,3],[0,3,2]]:[[0,1,2],[1,3,2]])keys.add(key(ids.map(i=>v[i]!)));}
  for(const a of motion.foundation.certificate.anchors){const mesh=machine.root.getObjectByName(`village-pendulum-7-${a.part}`)as Mesh,b=pendulumPackedBounds(mesh),patch=motion.drive.footings[a.patch]!,expected=Math.fround(Math.fround(patch.heights[0]-motion.drive.axle.origin[1])+motion.drive.axle.origin[1]);expect(b.min.y).toBe(expected);
   const x=(b.min.x+b.max.x)/2,z=(b.min.z+b.max.z)/2,half=Math.max((b.max.x-b.min.x)/2,(b.max.z-b.min.z)/2),ground=actualFootPatch(terrain,{x,z,half,heights:patch.heights});expect(Math.abs(ground.area-ground.expectedArea)).toBeLessThan(128*Number.EPSILON);expect(ground.maximumHeightError).toBe(0);anchors.set(a.part,{bounds:b,ground:patch.heights[0],bottom:expected});}
  const groundJoint=(a:SurfaceTriangle,b:SurfaceTriangle)=>{const id=a.mesh.userData.pendulumPart?.id,anchor=anchors.get(id);if(!anchor||a.mesh.userData.pendulumPart?.body!=='fixed'||b.mesh.name!=='village-landscape-2')return false;const vertices=[b.a,b.b,b.c].map(p=>p.clone().applyMatrix4(frameInverse));if(!keys.has(key(vertices))||!vertices.every(p=>p.y===anchor.ground)||b.normal.y!==1)return false;const points=pendulumIntersection(a,b).map(p=>p.applyMatrix4(frameInverse)),round=128*Number.EPSILON*Math.max(1,anchor.bounds.max.length());return points.length===2&&points.every(p=>p.x>=anchor.bounds.min.x-round&&p.x<=anchor.bounds.max.x+round&&p.z>=anchor.bounds.min.z-round&&p.z<=anchor.bounds.max.z+round&&p.y>=Math.min(anchor.bottom,anchor.ground)-round&&p.y<=Math.max(anchor.bottom,anchor.ground)+round);};
  const shared=pendulumParts(motion.station,motion.drive,(x,z)=>footingHeight(motion.drive,x,z)),shaft=machine.root.getObjectByName('village-pendulum-7-fixed-axle')as Mesh,hub=machine.root.getObjectByName('village-pendulum-7-hammer-hub')as Mesh;
  try{for(const[id,mesh]of[['fixed-axle',shaft],['hammer-hub',hub],['striking-bar',bar],['bell-stop',machine.root.getObjectByName('village-pendulum-7-bell-stop')as Mesh]]as const){const original=shared.parts.find(p=>p.id===id)!.geometry.getAttribute('position'),actual=mesh.geometry.getAttribute('position');expect(actual.count).toBe(original.count);for(let i=0;i<actual.count;i++)for(let j=0;j<3;j++)expect(actual.getComponent(i,j)).toBe((id==='fixed-axle'||id==='bell-stop')?Math.fround(original.getComponent(i,j)+motion.drive.axle.origin[j]!):original.getComponent(i,j));}}
  finally{shared.parts.forEach(p=>p.geometry.dispose());}
  const hp=hub.geometry.getAttribute('position'),axial=[Math.min(...Array.from({length:hp.count},(_,i)=>hp.getZ(i))),Math.max(...Array.from({length:hp.count},(_,i)=>hp.getZ(i)))];
  const journalJoint=(a:SurfaceTriangle,b:SurfaceTriangle)=>{if(!((a.mesh===shaft&&b.mesh===hub)||(a.mesh===hub&&b.mesh===shaft)))return false;const cert=motion.support.certificate;if(cert.model!=='nominal-common-cylinder'||Math.abs(cert.nominalMismatch)>cert.storageBound)return false;const points=pendulumIntersection(a,b),round=128*Number.EPSILON*Math.max(1,...motion.drive.axle.origin.map(Math.abs)),storage=2**-24*Math.max(...motion.drive.axle.origin.map(Math.abs));return points.length===2&&points.every(p=>{p.applyMatrix4(frameInverse).sub(new Vector3(...motion.drive.axle.origin));return Math.hypot(p.x,p.y)<=motion.support.radius+storage+round&&p.z>=axial[0]!-round&&p.z<=axial[1]!+round;});};
  const bell=machine.root.getObjectByName('village-pendulum-7-bell-stop')as Mesh,stopFrame=new Matrix4().makeRotationZ(motion.drive.stopAngle).setPosition(...motion.drive.axle.origin).invert(),bp=bell.geometry.getAttribute('position'),leftFace=Array.from({length:bp.count},(_,i)=>new Vector3().fromBufferAttribute(bp,i).applyMatrix4(stopFrame)).filter(p=>p.x<barSupport+.04),slab=[Math.min(barSupport,...leftFace.map(p=>p.x)),Math.max(barSupport,...leftFace.map(p=>p.x))],faceY=Array.from({length:packed.count},(_,i)=>i).filter(i=>packed.getX(i)===barSupport).map(i=>packed.getY(i)),depth=Math.max(Math.abs(slab[0]!-barSupport),Math.abs(slab[1]!-barSupport));
  let slope=Infinity;const xy=motion.core.profile.xy,n=xy.length/2;for(let i=0;i<n;i++){const j=(i+1)%n;if((xy[2*i]===barSupport)!==(xy[2*j]===barSupport))slope=Math.min(slope,Math.abs((xy[2*i]!-xy[2*j]!)/(xy[2*i+1]!-xy[2*j+1]!)));}expect(slope).toBeGreaterThan(0);expect(Number.isFinite(slope)).toBe(true);
  const zmin=Math.max(Math.min(...Array.from({length:packed.count},(_,i)=>packed.getZ(i))),Math.min(...leftFace.map(p=>p.z))),zmax=Math.min(Math.max(...Array.from({length:packed.count},(_,i)=>packed.getZ(i))),Math.max(...leftFace.map(p=>p.z)));
  let atBell=false;
  const stopJoint=(a:SurfaceTriangle,b:SurfaceTriangle)=>{if(!atBell||!((a.mesh===bar&&b.mesh===bell)||(a.mesh===bell&&b.mesh===bar)))return false;const points=pendulumIntersection(a,b),round=128*Number.EPSILON*Math.max(1,motion.drive.bar.arm);return points.length===2&&points.every(p=>{p.applyMatrix4(frameInverse).applyMatrix4(stopFrame);return p.x>=slab[0]!-round&&p.x<=slab[1]!+round&&p.y>=Math.min(...faceY)-depth/slope-round&&p.y<=Math.max(...faceY)+depth/slope+round&&p.z>=zmin-round&&p.z<=zmax+round;});};
  const probes=solidProbes(f.world.scene,.3).filter(p=>p.mesh!==f.probe.marble?.mesh&&p.mesh!==bar);
  for(const motionEnabled of[true,false])for(const time of [...times].filter(t=>t>=motion.contact&&t<=Math.max(motion.end,motion.actorEnd)).sort((a,b)=>a-b)){
   f.world.film(time,motionEnabled);f.world.scene.updateMatrixWorld(true);machine.sample(time,marble);atBell=time>=motion.bellTime&&motion.partnerAngle(time)===motion.drive.stopAngle;const expected=new Matrix4().makeRotationZ(motion.partnerAngle(time)).setPosition(...motion.drive.axle.origin).premultiply(machine.root.matrixWorld);for(let i=0;i<16;i++)expect(Math.abs(hub.matrixWorld.elements[i]!-expected.elements[i]!)).toBeLessThanOrEqual(128*Number.EPSILON*Math.max(1,Math.abs(expected.elements[i]!)));
   let sphereFailure:unknown;const local=new Vector3(),nearest=new Vector3();for(const probe of probes){if(!visible(probe.mesh))continue;local.copy(marble).applyMatrix4(probe.inverse.copy(probe.mesh.matrixWorld).invert());if(!probe.bounds.containsPoint(local))continue;for(const face of probe.triangles){if(!face.bounds.containsPoint(local))continue;face.triangle.closestPointToPoint(local,nearest);const distance=local.distanceTo(nearest)*probe.scale,round=128*Number.EPSILON*Math.max(1,marble.length());if(distance<.3-round){sphereFailure={mesh:probe.mesh.name,distance,point:nearest.clone().applyMatrix4(probe.mesh.matrixWorld).toArray(),triangle:[face.triangle.a,face.triangle.b,face.triangle.c].map(p=>p.toArray())};break;}}if(sphereFailure)break;}
   if(sphereFailure)reports.push({time,motionEnabled,sphereFailure});expect(sphereFailure).toBeUndefined();
   let distance=Infinity;for(const face of surfaceTriangles(bar)){triangle.set(face.a,face.b,face.c).closestPointToPoint(marble,closest);distance=Math.min(distance,closest.distanceTo(marble));}
   const arithmetic=128*Number.EPSILON*Math.max(1,marble.length());expect(distance).toBeGreaterThanOrEqual(.3-arithmetic);
   const all=surfaceTriangles(f.world.scene).filter(s=>visible(s.mesh)&&s.mesh!==f.probe.marble?.mesh),hardware=all.filter(s=>s.mesh.userData.pendulumPart);
   const crossings=pendulumCrossings(hardware,all,motion.drive,barSupport,(a,b)=>groundJoint(a,b)||journalJoint(a,b)||stopJoint(a,b));if(crossings.length)reports.push({time,motionEnabled,crossings});expect(crossings.length,JSON.stringify(crossings.slice(0,2))).toBe(0);
   const region=new Box3();for(const face of hardware)region.union(face.bounds);
   const exposed=exposedOverlaps(all.filter(s=>s.bounds.intersectsBox(region))).filter(o=>hardware.includes(o.a)||hardware.includes(o.b));if(exposed.length)reports.push({time,motionEnabled,exposed:exposed.map(o=>({a:o.a.mesh.name,b:o.b.mesh.name,point:o.point.toArray(),area:o.area}))});expect(exposed).toEqual([]);
   machine.contactBounds(7,bounds);for(const face of hardware)for(const p of[face.a,face.b,face.c])expect(bounds.containsPoint(p)).toBe(true);
   const active=motion.contactEpisodes.filter(e=>time>=e.start&&time<=e.end).map(e=>e.id);reports.push({time,motionEnabled,distance,ownedEpisodeIds:active});
  }
  complete=true;
 }finally{writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/mill-geometry5.json',JSON.stringify({scope:'Actual Mill affected interval: strict raw all-solid sphere/crossings, explicit finite joint patches, terrain/exposed/bounds; no tolerance inherited from broad .002 helpers',complete,duration:f.probe.machine.route.duration,actorEnd:motion.actorEnd,reports},null,2),{flag:'wx'});f.dispose();}
},240000);
