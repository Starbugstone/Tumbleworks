import { expect, it } from 'vitest';
import { mechanismMatrix } from '../../src/view/machine-primitives';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { CLOCKMAKERS_HILL } from '../../src/world/villages/clockmakers-hill';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles } from './surface-overlap';
import { trackCrossings, visible } from './village-geometry';

it.each([6, 2])('Clock %i lifts clear of the dock; the former rotation-only deck crosses its outgoing rails', stop => {
  const {world,probe,dispose}=villageWorld(3,true);
  try {
    const motion=new VillageRollingPrefix(CLOCKMAKERS_HILL.plan).retained.find(value=>value.station.stop===stop)!;
    const phase=stop===6?.94:.8;
    world.film(motion.carryStart+(motion.carryEnd-motion.carryStart)*phase);
    const crossings=()=>{
      const surfaces=surfaceTriangles(world.scene).filter(surface=>visible(surface.mesh)&&surface.mesh!==probe.marble?.mesh);
      return trackCrossings(surfaces.filter(surface=>surface.mesh.name.startsWith('village-track-')),surfaces);
    };
    expect(crossings()).toEqual([]);
    const mechanism=motion.station.mechanism;
    if(!('dockingLift' in mechanism))throw new Error('Expected a docking cam');
    const carrier=world.scene.getObjectByName(`village-${stop}-carrier`)!;
    mechanismMatrix({...mechanism,dockingLift:undefined},motion.station.anchor,phase,carrier.matrix);
    carrier.matrixWorldNeedsUpdate=true;
    expect(crossings().some(hit=>hit.track===`village-track-connector-${stop}-${stop-1}` || hit.solid===`village-track-connector-${stop}-${stop-1}`)).toBe(true);
  }finally{dispose();}
},30_000);
