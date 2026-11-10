import { expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { CLOCKMAKERS_HILL } from '../../src/world/villages/clockmakers-hill';
import { villageWorld } from './village-world-fixture';

it('publishes only solved Clock capture/carry/release intervals and all ten actual contacts', () => {
  const {probe,dispose}=villageWorld(3);
  try {
    const compiled=new VillageRollingPrefix(CLOCKMAKERS_HILL.plan), route=probe.machine.route;
    expect(route.contacts.map(contact=>contact.stop)).toEqual([9,8,7,6,5,4,3,2,1,0]);
    expect(route.transfers).toEqual(compiled.transfers);
    expect(route.motionStatus.state).toBe('ready');
    for(const stop of [6,2,1]) expect(route.transfers.filter(transfer=>transfer.stop===stop).map(transfer=>transfer.kind)).toEqual(['capture','carry','release']);
  }finally{dispose();}
});

it('renders each finite Clock weight stroke once and caches every carrier and linkage envelope', () => {
  const {world,probe,dispose}=villageWorld(3);
  try {
    const compiled=new VillageRollingPrefix(CLOCKMAKERS_HILL.plan), bounds=new Box3(), whole=new Box3(), start=new Vector3(), end=new Vector3();
    probe.machine.bounds(whole);
    for(const motion of compiled.retained){
      const stop=motion.station.stop, source=world.scene.getObjectByName(motion.sourceId)!;
      expect(source).toBeDefined();
      probe.machine.apply(motion.start);source.getWorldPosition(start);
      probe.machine.apply(motion.end);source.getWorldPosition(end);
      expect(start.y-end.y).toBeCloseTo(motion.station.retention!.weightDrop,9);
      expect(motion.ledger.available(motion.sourceId)).toBe(0);
      probe.machine.contactBounds(stop,bounds);
      const ids=probe.machine.route.contacts.find(contact=>contact.stop===stop)!.moverIds;
      for(let i=0;i<=60;i++){
        probe.machine.apply(motion.start+(motion.end-motion.start)*i/60);
        for(const id of ids){
          const object=world.scene.getObjectByName(id)!;
          const actual=new Box3().setFromObject(object);
          expect(bounds.containsBox(actual),`${id} contact envelope at ${i}`).toBe(true);
          expect(whole.containsBox(actual),`${id} complete envelope at ${i}`).toBe(true);
        }
      }
      probe.machine.apply(motion.start);source.getWorldPosition(end);expect(end.distanceTo(start)).toBeLessThan(1e-9);
    }
  }finally{dispose();}
});
