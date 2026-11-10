import {expect,it} from 'vitest';
import {Mesh} from 'three';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {trackCrossings,exposedOverlaps} from './village-geometry';
it('joins the pitched timber deck underside and rejects the former penetrating fork bracket',()=>{
 const {world,dispose}=villageWorld(2,true);
 try {
  world.film(0);
  const check=()=>{
   const surfaces=surfaceTriangles(world.scene),track=surfaces.filter(s=>s.mesh.name==='village-track-carrier-6');
   const bracket=surfaces.filter(s=>s.mesh.name==='village-6-fork-bearing');
   expect(bracket.length).toBeGreaterThan(0);
   return {crossings:trackCrossings(track,bracket),overlaps:exposedOverlaps([...track,...bracket])};
  };
  expect(check()).toEqual({crossings:[],overlaps:[]});
  const bracket=world.scene.getObjectByName('village-6-fork-bearing');
  expect(bracket).toBeInstanceOf(Mesh);
  (bracket as Mesh).geometry.translate(0,.04,0);
  expect(check().crossings.length).toBeGreaterThan(0);
 } finally {dispose();}
});
