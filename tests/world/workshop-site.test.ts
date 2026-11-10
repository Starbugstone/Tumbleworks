import { expect, it } from 'vitest';
import * as THREE from 'three';
import { findWorkshopPass, workshopSite, workshopSignPlacement, WORKSHOP_BUILDING } from '../../src/world/workshop-building';
import { WorkshopBuilding } from '../../src/view/workshop-building';

it('keeps the sign and door on a relocated, uniformly scaled and rotated Workshop', () => {
  const site = workshopSite({ position: [-3, 2, 4], scale: 0.88, yaw: Math.PI / 2 }, [-1, 4, 5], { from: 7, to: 6 });
  expect(site.door[0]).toBeCloseTo(-1.8, 6);
  expect(site.door[1]).toBeCloseTo(2.048, 6);
  expect(site.door[2]).toBeCloseTo(4, 6);
  const material = new THREE.MeshBasicMaterial(), model = new WorkshopBuilding(material, workshopSignPlacement(site));
  try {
    expect(model.sign.position.toArray()).toEqual([...site.pivot]);
    expect(model.fixed.position.toArray()).toEqual([...site.pivot]);
    expect(model.sign.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    expect(model.sign.scale.x).toBeCloseTo(0.8, 6);
    model.apply(4.4, 4.25); expect(model.sign.rotation.z).not.toBe(0);
    model.reset(); expect(model.sign.rotation.z).toBe(0);
    expect(model.sign.rotation.y).toBeCloseTo(Math.PI / 2, 6);
  } finally { model.dispose(); material.dispose(); }
});

it('finds a pass only on the plan-declared connector beside that village house', () => {
  const observations: number[] = [];
  const at = { x: 0, y: 0, z: 0 };
  const found = findWorkshopPass((seconds, point) => {
    observations.push(seconds); point.x = seconds; point.y = 2; point.z = 3;
  }, at, { start: 3, end: 5, house: { x: 4.25, y: 2, z: 3 } });
  expect(found).toBeCloseTo(4.25, 6);
  expect(observations.every(time => time >= 3 && time <= 5)).toBe(true);
  expect(() => findWorkshopPass(() => undefined, at, { start: 5, end: 3, house: WORKSHOP_BUILDING.house })).toThrow('interval');
});
