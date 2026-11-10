import {expect,it} from 'vitest';
import {CylinderGeometry,Mesh} from 'three';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {trackCrossings} from './village-geometry';
it.each([0,1,5,9])('keeps the connected Gardens linkage %i inside its rims and rejects the original bar',stop=>{
 const {world,probe,dispose}=villageWorld(1,true);
 try{probe.machine.route.requirePhysical();world.film(0);
 const group=world.scene.getObjectByName(`village-${stop}-${stop===0?'damper':'fork'}`)!;
 const check=()=>{const faces=surfaceTriangles(world.scene);return trackCrossings(faces.filter(f=>f.mesh.name.startsWith('village-track-')),faces.filter(f=>f.mesh.parent===group));};
 expect(check()).toEqual([]);
 const bar=group.children.find(o=>o instanceof Mesh&&o.geometry instanceof CylinderGeometry) as Mesh;
 expect(bar).toBeDefined();bar.geometry.scale(1,1,stop===0?1.32/.44:1/.56);
 expect(check().length).toBeGreaterThan(0);
 }finally{dispose();}
});

