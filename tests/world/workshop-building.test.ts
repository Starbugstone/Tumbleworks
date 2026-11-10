import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WorldAssets } from '../../src/view/world-assets';
import { WorkshopBuilding } from '../../src/view/workshop-building';
import { findWorkshopPass, WORKSHOP_BUILDING, workshopSwing } from '../../src/world/workshop-building';
import { RubeRoute, createRubeSample } from '../../src/world/rube-sequence';
import { TestWorldScene as WorldScene } from './cinematic-scene-fixture';
import { MarbleFactory } from '../../src/engine/marbles';
import type { Stage } from '../../src/engine/stage';
import { villageScenePlan } from '../../src/world/village-plans';

it('returns exact rest, normal peaks and a smaller reduced response without overshoot', () => {
  const pass = 9.7;
  expect(workshopSwing(pass - 1, pass)).toBe(0); expect(workshopSwing(pass + 1, pass)).toBe(0);
  expect(workshopSwing(pass + 0.14, pass)).toBeCloseTo(-0.45, 12);
  expect(workshopSwing(pass + 0.44, pass)).toBeCloseTo(0.1, 12);
  expect(workshopSwing(pass + 0.89, pass)).toBe(0);
  expect(workshopSwing(pass + 0.09, pass, true)).toBeCloseTo(-0.25, 12);
  expect(workshopSwing(pass + 0.34, pass, true)).toBe(0);
  for (let frame = -30; frame <= 240; frame++) {
    const time = pass + frame / 240;
    expect(Number.isFinite(workshopSwing(time, pass))).toBe(true);
    expect(workshopSwing(time, pass, true)).toBeLessThanOrEqual(0);
    expect(workshopSwing(time, pass, true)).toBeGreaterThanOrEqual(-0.25);
  }
});

it('derives the pass from the final authored route and responds to a shifted closest approach', () => {
  const assets = new WorldAssets(), route = new RubeRoute(assets.anchors), sample = createRubeSample();
  const pass = findWorkshopPass((time, out) => { route.sample(time, out); }, sample);
  expect(pass).toBeGreaterThanOrEqual(9.3); expect(pass).toBeLessThanOrEqual(10.1);
  for (const closest of [9.42, 9.96]) {
    const point = { x: 0, y: 0, z: 0 };
    expect(findWorkshopPass((time, out) => { out.x = WORKSHOP_BUILDING.house.x + time - closest; out.y = WORKSHOP_BUILDING.house.y; out.z = WORKSHOP_BUILDING.house.z; }, point)).toBeCloseTo(closest, 7);
  }
  assets.dispose();
});

it('keeps every moving sign triangle clear of the actual house throughout both swings', () => {
  const assets = new WorldAssets(), material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const building = new WorkshopBuilding(material), house = assets.model('house-a', material);
  house.position.set(7.7, 3.04, -1.6); house.scale.setScalar(1.1); house.updateMatrixWorld(true);
  let front = -Infinity;
  house.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) front = Math.max(front, new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld).z);
  });
  expect(front).toBeCloseTo(-0.232, 3);
  const mesh = building.sign.children[0] as THREE.Mesh;
  const triangles = (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
  expect(building.sign.children).toHaveLength(1); expect(triangles).toBeLessThanOrEqual(120);
  const positions = mesh.geometry.getAttribute('position'), vertex = new THREE.Vector3();
  for (const reduced of [false, true]) for (let frame = -15; frame <= 240; frame++) {
    building.apply(frame / 240, 0, reduced); building.sign.updateMatrixWorld(true);
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
      // All triangle interiors inherit this separating plane from their vertices.
      expect(vertex.z - front).toBeGreaterThanOrEqual(0.3);
    }
  }
  building.reset(); expect(building.sign.rotation.z).toBe(0);
  const disposeMaterial = vi.spyOn(material, 'dispose'); building.dispose(); expect(disposeMaterial).not.toHaveBeenCalled();
  assets.dispose(); material.dispose();
});

it('drives the installed Workshop sign as the actual film marble passes it', () => {
  const stage = { canvas: { clientWidth: 375, clientHeight: 690 }, renderer: { setSize: vi.fn() },
    rect: { left: 0, top: 0, width: 375, height: 690 }, marbles: new MarbleFactory(),
    createScene: () => new THREE.Scene(), draw: vi.fn(), disposeScene: (scene: THREE.Scene) => scene.clear(),
  } as unknown as Stage;
  const world = new WorldScene(stage, 0); world.resize();
  const site = villageScenePlan(0).workshop;
  const source = world.plan.stations.find(station => station.stop === site.connector.from)!;
  const destination = world.plan.stations.find(station => station.stop === site.connector.to)!;
  const pass = findWorkshopPass((time, point) => world.machine.sample(time, point), new THREE.Vector3(), {
    start: source.end, end: destination.start, house: { x: site.house.position[0], y: site.house.position[1], z: site.house.position[2] },
  });
  const sign = world.scene.getObjectByName('workshop-hammer-sign')!;
  try {
    world.film(pass - 0.07); expect(sign.rotation.z).toBe(0);
    for (const reduced of [false, true]) {
      world.film(pass + (reduced ? 0.09 : 0.14), !reduced);
      expect(sign.rotation.z).toBeCloseTo(reduced ? -0.25 : -0.45, 8);
      world.scene.updateMatrixWorld(true);
      const center = sign.localToWorld(new THREE.Vector3(0, -WORKSHOP_BUILDING.drop, 0)).project(world.camera);
      expect(Math.abs(center.x), `Workshop sign horizontal framing, reduced=${reduced}`).toBeLessThan(1);
      expect(Math.abs(center.y)).toBeLessThan(1);
      sign.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        for (let index = 0; index < positions.count; index++) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld).project(world.camera);
          expect(Math.abs(point.x)).toBeLessThanOrEqual(1); expect(Math.abs(point.y)).toBeLessThanOrEqual(1);
        }
      });
    }
    world.film(pass + 0.9); expect(sign.rotation.z).toBe(0);
  } finally { world.dispose(); }
});
