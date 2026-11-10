import{enrolTestMachine}from'./startup-scene-fixture';
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VILLAGE_SCENE_PLANS, villageScenePlan, type VillageScenePlan } from '../../src/world/village-plans';
import { validateVillagePlan } from '../../src/world/village-program';
import { VILLAGE_DURATION, VILLAGE_RADIUS } from '../../src/world/village-plan';
import { compileTerrain, terrainHeightAt, terrainOccupancy, type VillageTerrain } from '../../src/world/village-terrain';
import { VillageMachine } from '../../src/view/village-machine';
import { VillageFilmCamera } from '../../src/view/village-film-camera';
import { bindNativeTerrain, villageTerrainGeometry } from '../../src/view/village-terrain';
import { WorldKitAssets } from '../../src/view/world-kit';
import { MIN_SEQUENCE_DISTANCE, MIN_SPATIAL_DISTANCE, sequenceDistance, spatialDistance } from './village-identity';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';

const CLEARANCE = VILLAGE_RADIUS + 0.4;
const REPORT = process.env.TW_LAYOUT_REPORT ?? 'output/current/village-layouts/plan-report.json';

interface Built { scene: VillageScenePlan; terrain: VillageTerrain; machine: VillageMachine; route: THREE.Vector3[] }
function build(scene: VillageScenePlan, assets: WorldKitAssets, material: THREE.Material): Built {
  validateVillagePlan(scene.plan);
  const terrain = compileTerrain(scene.terrain);
  const native=villageTerrainGeometry(terrain),provider=new THREE.Mesh(native,material);bindNativeTerrain(native,provider);
  const home=scene.plan.staticSupports?new THREE.Scene():undefined;home?.add(provider);let machine:VillageMachine;try{machine=new VillageMachine(scene.plan,assets,material,(x,z)=>terrainHeightAt(terrain,x,z),provider,home);if(home){home.add(machine.root);enrolTestMachine(machine);}}finally{native.dispose();}
  const route = Array.from({ length: VILLAGE_DURATION * 120 + 1 }, (_, frame) => { const point = new THREE.Vector3(); machine.sample(frame / 120, point); return point; });
  return { scene, terrain, machine, route };
}
function nearest(route: readonly THREE.Vector3[], box: THREE.Box3): number {
  let minimum = Infinity;
  for (const point of route) minimum = Math.min(minimum, box.distanceToPoint(point));
  return minimum;
}
function modelBox(assets: WorldKitAssets, material: THREE.Material, model: string, position: readonly [number, number, number], yaw: number, scale: number): THREE.Box3 {
  const group = assets.model(model, material);
  if (!group.children.length) throw new Error(`Unknown kit model ${model}`);
  group.position.set(...position); group.rotation.y = yaw; group.scale.setScalar(scale); group.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(group);
}

describe('the six authored villages', () => {
  const assets = new WorldKitAssets(), material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const report: Record<string, unknown> = {};

  it('registers one explicit plan per chapter and no fallback', () => {
    expect(VILLAGE_SCENE_PLANS.map(scene => scene.chapter)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const scene of VILLAGE_SCENE_PLANS) expect(scene.plan.chapter).toBe(scene.chapter);
    expect(() => villageScenePlan(6)).toThrow('no authored village plan');
    expect(new Set(VILLAGE_SCENE_PLANS.map(scene => scene.plan.profile)).size).toBe(6);
  });

  for (const scene of VILLAGE_SCENE_PLANS) describe(`chapter ${scene.chapter}`, () => {
    it('compiles through the real machine, terrain and camera with every mount on authored ground', () => {
      const built = build(scene, assets, material);
      try {
        const camera = new VillageFilmCamera(built.machine, built.machine.route);
        camera.resize(375 / 690); camera.resize(16 / 9);
        const geometry = villageTerrainGeometry(built.terrain);
        const overview = villageTerrainGeometry(scene.terrain, 'overview');
        const terrainTriangles = geometry.getAttribute('position').count / 3, overviewTriangles = overview.getAttribute('position').count / 3;
        geometry.dispose(); overview.dispose();
        // The marble never enters the drawn ground; water and void are only crossed on declared spans.
        const buried: number[] = [];
        built.route.forEach((point, frame) => {
          const ground = terrainHeightAt(built.terrain, point.x, point.z);
          if (ground !== undefined && point.y - VILLAGE_RADIUS < ground - 0.002) buried.push(frame / 120);
        });
        expect(buried, 'route frames inside terrain').toEqual([]);
        for (const station of scene.plan.stations) {
          const ground = terrainHeightAt(built.terrain, station.supports?.[0]?.[0] ?? station.anchor[0], station.supports?.[0]?.[2] ?? station.anchor[2]);
          expect(ground, `stop ${station.stop} foundation ground`).toBeDefined();
          expect(Math.abs(station.anchor[0])).toBeLessThanOrEqual(9.5);
          expect(station.badge[1]).toBeGreaterThan(station.anchor[1]);
        }
        // Badges are the map's tap targets (48 px apart on the phone); anchors only need their own footprint.
        const ordered = [...scene.plan.stations].sort((a, b) => a.stop - b.stop);
        const anchors = ordered.map(station => new THREE.Vector3(...station.anchor)), badges = ordered.map(station => new THREE.Vector3(...station.badge));
        for (let a = 0; a < anchors.length; a++) for (let b = a + 1; b < anchors.length; b++) {
          expect(anchors[a]!.distanceTo(anchors[b]!), `stops ${a} and ${b} anchors too close`).toBeGreaterThanOrEqual(1.5);
          expect(badges[a]!.distanceTo(badges[b]!), `stops ${a} and ${b} badges too close`).toBeGreaterThanOrEqual(3.0);
        }
        report[`chapter-${scene.chapter}`] = {
          profile: scene.plan.profile, construction: scene.construction, machineTriangles: built.machine.triangles,
          movingGroups: built.machine.movingGroups, terrainTriangles, overviewTriangles,
          sequence: [...scene.plan.stations].sort((a, b) => b.stop - a.stop).map(station => station.mechanism.kind),
          restDistance: camera.restDistance,
        };
      } finally { built.machine.dispose(); }
    });

    it('keeps scenery, the Workshop and reward slots clear of the route and standing on land', () => {
      const built = build(scene, assets, material);
      try {
        const failures: string[] = [];
        const check = (label: string, box: THREE.Box3): void => {
          const distance = nearest(built.route, box);
          if (distance < CLEARANCE) failures.push(`${label} ${distance.toFixed(2)}`);
        };
        for (const [index, piece] of scene.scenery.entries()) {
          check(`scenery ${index} ${piece.model}`, modelBox(assets, material, piece.model, piece.position, piece.yaw, piece.scale));
          const ground = terrainHeightAt(built.terrain, piece.position[0], piece.position[2]);
          const floating = piece.model === 'boat' ? terrainOccupancy(built.terrain, piece.position[0], piece.position[2]) !== 'water' : ground === undefined || Math.abs(ground - piece.position[1]) > 0.35;
          if (floating) failures.push(`scenery ${index} ${piece.model} off its ground`);
        }
        const house = scene.workshop.house;
        check('workshop house', modelBox(assets, material, 'house-a', house.position, house.yaw, house.scale));
        expect(terrainHeightAt(built.terrain, house.position[0], house.position[2])).toBeDefined();
        const projects = WORKSHOP_PROJECTS.filter(project => project.chapter === scene.chapter);
        expect(scene.rewards.map(slot => slot.project).sort()).toEqual(projects.map(project => project.id).sort());
        for (const slot of scene.rewards) {
          check(`reward ${slot.project}`, new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...slot.position).add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(2.4, 2.2, 2.6)));
          expect(terrainHeightAt(built.terrain, slot.position[0], slot.position[2]), `${slot.project} ground`).toBeDefined();
        }
        expect(scene.plan.connectors.some(link => link.from === scene.workshop.connector.from && link.to === scene.workshop.connector.to)).toBe(true);
        for (const piece of scene.overview) expect(assets.model(piece.model, material).children.length, piece.model).toBeGreaterThan(0);
        expect(failures).toEqual([]);
      } finally { built.machine.dispose(); }
    });
  });

  it('differ from each other in mechanism order and in the shape of their stops, and records the report', () => {
    const scenes = VILLAGE_SCENE_PLANS;
    const sequences = scenes.map(scene => [...scene.plan.stations].sort((a, b) => b.stop - a.stop).map(station => station.mechanism.kind));
    const shapes = scenes.map(scene => [...scene.plan.stations].sort((a, b) => a.stop - b.stop).map(station => ({ x: station.anchor[0], y: station.anchor[1], z: station.anchor[2] })));
    const pairs: Record<string, { sequence: number; spatial: number }> = {};
    for (let a = 0; a < scenes.length; a++) for (let b = a + 1; b < scenes.length; b++) {
      const sequence = sequenceDistance(sequences[a]!, sequences[b]!), spatial = spatialDistance(shapes[a]!, shapes[b]!);
      pairs[`${scenes[a]!.chapter}-${scenes[b]!.chapter}`] = { sequence, spatial };
      expect(sequence, `chapters ${a} and ${b} share too much mechanism order`).toBeGreaterThanOrEqual(MIN_SEQUENCE_DISTANCE);
      expect(spatial, `chapters ${a} and ${b} share a layout`).toBeGreaterThanOrEqual(MIN_SPATIAL_DISTANCE);
    }
    report.pairs = pairs;
    mkdirSync('output/current/village-layouts', { recursive: true });
    writeFileSync(REPORT, JSON.stringify(report, null, 1));
    material.dispose(); assets.dispose();
  });
});
