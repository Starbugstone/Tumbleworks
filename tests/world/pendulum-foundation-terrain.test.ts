import{expect,it}from'vitest';
import{Vector3,Mesh}from'three';
import{compileTerrain,terrainHeightAt}from'../../src/world/village-terrain';
import{villageScenePlan}from'../../src/world/village-plans';
import{PendulumFoundation}from'../../src/world/pendulum-foundation';
import{PendulumSupport,footingHeight}from'../../src/world/pendulum-support';
import{pendulumParts}from'../../src/view/pendulum-parts';
import{actualFootPatch}from'./pendulum-feet';
import{villageWorld}from'./village-world-fixture';
it('O5 corner-only terrain mutants keep all four heights but lose finite interior area or planarity',()=>{
 const terrain=compileTerrain({size:[2,2],cells:[8,8],base:0,water:-1,skirtDepth:1,outline:[[-1,-1],[1,-1],[1,1],[-1,1]],features:[],palette:{grass:0,grassAlt:0,rock:0,shore:0,water:0,cliff:0}}),patch={x:0,z:0,half:.75,heights:[0,0,0,0]as const};
 const baseline=actualFootPatch(terrain,patch);expect(baseline.area).toBe(baseline.expectedArea);expect(baseline.maximumHeightError).toBe(0);
 const heights=terrain.heights.slice();heights[4*(terrain.columns+1)+4]=.01;const bump={...terrain,heights};
 for(const x of[-.75,.75])for(const z of[-.75,.75])expect(terrainHeightAt(bump,x,z)).toBe(0);
 expect(actualFootPatch(bump,patch).maximumHeightError).toBeGreaterThan(.009);
 const cells=[...terrain.cells];cells[4*terrain.columns+4]='void';const hole={...terrain,cells};for(const x of[-.75,.75])for(const z of[-.75,.75])expect(terrainHeightAt(hole,x,z)).toBe(0);
 expect(actualFootPatch(hole,patch).area).toBeLessThan(baseline.expectedArea);
});
it('actual Harbour and Mill foundation rectangles/graph match current full terrain patches and actual Scene matrices',()=>{
 for(const chapter of[0,2]){const stop=chapter===0?1:7,scene=villageScenePlan(chapter),station=scene.plan.stations.find(s=>s.stop===stop)!,drive=station.strikerDrive!;if(drive.kind!=='pendulum')throw new Error('Actual drive required');
 const terrain=compileTerrain(scene.terrain),parts=pendulumParts(station,drive,(x,z)=>footingHeight(drive,x,z)),world=villageWorld(chapter,true);
 try{
  const foundation=PendulumFoundation.enrol(station,drive,parts,PendulumSupport.enrol(station,drive,parts));world.world.scene.updateMatrixWorld(true);
  for(const a of foundation.certificate.anchors){const patch=drive.footings[a.patch]!,actual=actualFootPatch(terrain,patch);expect(actual.maximumHeightError).toBe(0);expect(Math.abs(actual.area-actual.expectedArea)).toBeLessThan(128*Number.EPSILON);
   const mesh=world.probe.machine.root.getObjectByName(`village-pendulum-${stop}-${a.part}`);expect(mesh).toBeInstanceOf(Mesh);if(!(mesh instanceof Mesh))throw new Error('Actual foot mesh missing');
   const buffer=mesh.geometry.getAttribute('position'),points=Array.from({length:buffer.count},(_,i)=>new Vector3().fromBufferAttribute(buffer,i).applyMatrix4(mesh.matrixWorld));
   for(const corner of a.corners){const expected=new Vector3(...corner).applyMatrix4(world.probe.machine.root.matrixWorld),storage=2**-24*Math.max(1,...corner.map(Math.abs))+128*Number.EPSILON;expect(Math.min(...points.map(p=>p.distanceTo(expected)))).toBeLessThanOrEqual(storage);}
  }
 }finally{parts.parts.forEach(p=>p.geometry.dispose());world.dispose();}}
});
