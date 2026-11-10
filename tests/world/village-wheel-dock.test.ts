import {expect,it,vi} from 'vitest';
import {writeFileSync} from 'node:fs';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {trackCrossings,exposedOverlaps,visible} from './village-geometry';
import {mechanismMatrix,villageEase} from '../../src/view/machine-primitives';
it.each([0,.5,1])('Mill fixed dock and full-width joints at carrier stroke %f',u=>{
 const {world,probe,dispose}=villageWorld(2,true),route=probe.machine.route,station=route.authoredPlan.stations.find(s=>s.stop===6)!;
 const carrier=route.carrierPose.bind(route),auxiliary=route.auxiliaryPose.bind(route);
 const spy=vi.spyOn(route,'carrierPose').mockImplementation((stop,time,target)=>stop===6?mechanismMatrix(station.mechanism,station.anchor,u,target):carrier(stop,time,target));
 const aux=vi.spyOn(route,'auxiliaryPose').mockImplementation((stop,part,time,target)=>{auxiliary(stop,part,time,target);if(stop===6&&part==='wheel')target.angle=Math.PI*villageEase(u);});
 try{world.film(0);const surfaces=surfaceTriangles(world.scene).filter(s=>visible(s.mesh)&&s.mesh!==probe.marble?.mesh);
 const selected=(name:string)=>/^village-track-(connector-(7-6|6-5)|carrier-(7|6))$/.test(name);
 const crossings=trackCrossings(surfaces.filter(s=>selected(s.mesh.name)||s.mesh.name.startsWith('village-dock-6')),surfaces);
 const overlaps=exposedOverlaps(surfaces).filter(o=>selected(o.a.mesh.name)||selected(o.b.mesh.name)||o.a.mesh.name.startsWith('village-dock-6')||o.b.mesh.name.startsWith('village-dock-6')).map(o=>({a:o.a.mesh.name,b:o.b.mesh.name,point:o.point.toArray(),area:o.area}));
 if(crossings.length||overlaps.length)writeFileSync(`output/current/village-layouts/all-span-support/mill-dock-complete-${u}.json`,JSON.stringify({u,crossings,overlaps},null,2));
 expect(world.scene.getObjectByName('village-dock-6-girder')).toBeDefined();expect(crossings).toEqual([]);expect(overlaps).toEqual([]);
 }finally{spy.mockRestore();aux.mockRestore();dispose();}
},60000);
