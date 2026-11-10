import { Box3, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles } from './surface-overlap';
import { groundFoundations } from './ground-foundations';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { villageScenePlan } from '../../src/world/village-plans';

it.each([0,2])('chapter %i bounds every complete source9 mover and fits complete ground-post footprints',chapter=>{
 const f=villageWorld(chapter,true);
 try {
  const machine=f.probe.machine,contact=machine.route.contacts.find(c=>c.stop===9)!,bounds=new Box3(),whole=new Box3();
  const times=new Set([0,contact.start,contact.end,...machine.route.transfers.filter(t=>t.stop===9).flatMap(t=>[0,.25,.5,.75,1].map(u=>t.start+(t.end-t.start)*u))]);
  for(let i=0;i<=Math.ceil(contact.end*120);i++)times.add(Math.min(contact.end,i/120));
  for(const reduced of [false,true])for(const time of times){
   f.world.film(time,!reduced);f.world.scene.updateWorldMatrix(true,true);machine.contactBounds(9,bounds);machine.bounds(whole);
   for(const id of contact.moverIds){
    const mover=machine.root.getObjectByName(id)!;expect(mover,id).toBeDefined();
    const before=mover.matrix.toArray();
    for(const face of surfaceTriangles(mover))for(const point of [face.a,face.b,face.c]){
     expect(bounds.containsPoint(point),`${id} contact at ${time}`).toBe(true);expect(whole.containsPoint(point),`${id} whole at ${time}`).toBe(true);
    }
    machine.contactBounds(9,bounds);machine.bounds(whole);expect(mover.matrix.toArray()).toEqual(before);
   }
  }
  const terrain=compileTerrain(villageScenePlan(chapter).terrain),height=(x:number,z:number)=>terrainHeightAt(terrain,x,z);
  const feet=groundFoundations([machine.staticSolids[9]!],height).filter(foot=>foot.name==='village-rim-post-9');
  expect(feet.length).toBe(chapter===0?1:2);
  for(const foot of feet){
   const box=new Box3().setFromPoints(foot.bottom.flat()),storage=8*2**-24*Math.max(1,Math.abs(box.min.y));
   // Every intersected cell is proved flat land, so BOTH full terrain triangles
   // equal the bottom plane over the entire footprint, including its interior.
   const loX=Math.floor((box.min.x-terrain.originX)/terrain.cellWidth),hiX=Math.floor((box.max.x-terrain.originX)/terrain.cellWidth);
   const loZ=Math.floor((box.min.z-terrain.originZ)/terrain.cellDepth),hiZ=Math.floor((box.max.z-terrain.originZ)/terrain.cellDepth);
   expect(box.max.y-box.min.y).toBeLessThan(storage);
   for(let z=loZ;z<=hiZ;z++)for(let x=loX;x<=hiX;x++){
    expect(terrain.cells[z*terrain.columns+x]).toBe('land');
    for(const dx of [0,1])for(const dz of [0,1])expect(Math.abs(terrain.heights[(z+dz)*(terrain.columns+1)+x+dx]!-box.min.y)).toBeLessThan(storage);
   }
   expect(box.getSize(new Vector3()).x).toBeGreaterThan(.1);expect(box.getSize(new Vector3()).z).toBeGreaterThan(.1);
  }
 }finally{f.dispose();}
},30000);
