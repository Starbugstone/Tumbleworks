import { expect, it, vi } from 'vitest';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { CLOCKMAKERS_HILL } from '../../src/world/villages/clockmakers-hill';
import { Matrix4, Vector3 } from 'three';
import { villageWorld } from './village-world-fixture';

it('pays Clock top and cam work from a real descending release', () => {
  const prefix = new VillageRollingPrefix(CLOCKMAKERS_HILL.plan);
  expect(prefix.contacts.slice(0, 3).map(contact => contact.stop)).toEqual([9, 8, 7]);
  expect(prefix.contacts.map(contact => contact.stop)).toContain(6);
  expect(prefix.events).toHaveLength(1);
  const event = prefix.events[0]!;
  expect(event.incomingSpeed).toBeGreaterThan(event.outgoingSpeed);
  expect(event.outgoingSpeed).toBeGreaterThan(0);
  expect(event.cam.turns).toBeGreaterThan(3);
  expect(event.cam.end - event.cam.drive.contact).toBeGreaterThan(1);
  expect(event.cam.end - event.cam.drive.contact).toBeLessThan(3);
});

it('drives the actual Clock top, crown gear and gate from the compiled contact in both motion modes', () => {
  const { world, probe, dispose } = villageWorld(3);
  try {
    const route = probe.machine.route, contact = route.contacts.find(value => value.stop === 8)!;
    const top = world.scene.getObjectByName('village-8-top')!, gear = world.scene.getObjectByName('village-8-gear')!;
    const trip = world.scene.getObjectByName('village-8-trip')!, gate = world.scene.getObjectByName('village-8-escapement')!;
    expect(top).toBeDefined(); expect(trip).toBeDefined();
    const pose = { angle: 0, x: 0, y: 0, z: 0 };
    route.auxiliaryPose(8, 'top', contact.contact - .001, pose); expect(pose.angle).toBe(0);
    route.auxiliaryPose(8, 'top', contact.contact + 3, pose); expect(pose.angle).toBeGreaterThan(6 * Math.PI);
    const topAngle = pose.angle;
    route.auxiliaryPose(8, 'gear', contact.contact + 3, pose); expect(pose.angle).toBe(-2 * topAngle);
    route.auxiliaryPose(8, 'striker', contact.contact + 3, pose); expect(pose.angle).toBe(Math.PI / 2);
    route.auxiliaryPose(8, 'gate', contact.contact + 3, pose); expect(pose.y).toBeCloseTo(1.2, 10);
    const saved = [new Matrix4(), new Matrix4(), new Matrix4(), new Matrix4()];
    const measureTopTravel = () => {
      probe.machine.apply(contact.contact - .001);
      const inverse = top.matrix.clone().invert(), relative = new Matrix4(), axis = new Vector3();
      let previous = 0, travel = 0;
      for (let frame = 0; frame <= 360; frame++) {
        probe.machine.apply(contact.contact + frame / 120);
        relative.multiplyMatrices(inverse, top.matrix);
        axis.set(1, 0, 0).transformDirection(relative);
        const angle = Math.atan2(-axis.z, axis.x);
        let delta = angle - previous;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        travel += delta; previous = angle;
      }
      return travel;
    };
    expect(measureTopTravel(), 'actual rendered shaft must make multiple complete turns').toBeGreaterThan(6 * Math.PI);
    const original = route.auxiliaryPose.bind(route);
    const mutant = vi.spyOn(route, 'auxiliaryPose').mockImplementation((stop, part, seconds, target) => {
      original(stop, part, seconds, target);
      if (part === 'top') target.angle = Math.min(Math.PI, target.angle);
    });
    expect(measureTopTravel(), 'the former half-turn renderer is rejected').toBeLessThan(6 * Math.PI);
    mutant.mockRestore();
    for (const time of [contact.contact - .01, contact.contact + .04, contact.contact + .4, contact.contact + 3]) {
      probe.machine.apply(time, false);
      [top, gear, trip, gate].forEach((object, index) => saved[index]!.copy(object.matrix));
      probe.machine.apply(time, true);
      [top, gear, trip, gate].forEach((object, index) => expect(object.matrix.equals(saved[index]!)).toBe(true));
    }
    expect(() => route.requirePhysical()).not.toThrow();
  } finally { dispose(); }
});
