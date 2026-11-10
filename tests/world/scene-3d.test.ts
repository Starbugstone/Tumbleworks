import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Stage } from '../../src/engine/stage';
import { MarbleFactory } from '../../src/engine/marbles';
import { TestWorldScene as WorldScene } from './cinematic-scene-fixture';
import * as progress from '../../src/progress';
import { worldProgress } from '../../src/world/progression';

function stage(): Stage {
  return { canvas: { clientWidth: 375, clientHeight: 690 }, renderer: { setSize: vi.fn() },
    rect: { left: 0, top: 0, width: 375, height: 690 }, marbles: new MarbleFactory(),
    createScene: () => new THREE.Scene(), draw: vi.fn(), disposeScene: (scene: THREE.Scene) => scene.clear(),
  } as unknown as Stage;
}
describe('volumetric valley camera and film', () => {
  it('installs a newly earned project on the existing village scene before reload, exactly once', () => {
    const completed = vi.spyOn(progress, 'completedLevels').mockReturnValue([]);
    const world = new WorldScene(stage(), 0);
    try {
      const levels = Array.from({ length: 10 }, (_, stop) => ['conveyor', 'loop', 'tube'].map(kind => ({ id: `${kind}-${stop}`, kind }))).flat();
      const chapter = worldProgress(levels, new Set()).chapters[0]!;
      expect(world.scene.getObjectByName('project-board-212')).toBeUndefined();
      completed.mockReturnValue(['board-212']);
      world.update(chapter, false);
      const reward = world.scene.getObjectByName('project-board-212');
      expect(reward).toBeDefined();
      expect(new THREE.Box3().setFromObject(reward!).isEmpty()).toBe(false);
      world.update(chapter, false);
      expect(world.scene.children.filter(object => object.name === 'project-board-212')).toHaveLength(1);
      expect(world.scene.getObjectByName('project-board-212')).toBe(reward);
      expect(chapter.stops.every(stop => stop.status !== 'built')).toBe(true);
    } finally { world.dispose(); completed.mockRestore(); }
  });
  it('keeps ten badges separated within the upright phone at both orbit bounds', () => {
    const world = new WorldScene(stage(), 0); world.resize();
    expect(world.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    for (const yaw of [-15, -10, -5, 0, 5, 10, 15].map(degrees => degrees * Math.PI / 180)) {
      world.setYaw(yaw); const targets = world.targets(); expect(targets).toHaveLength(10);
      for (const target of targets) {
        expect(target.x).toBeGreaterThanOrEqual(29); expect(target.x).toBeLessThanOrEqual(346);
        expect(target.y).toBeGreaterThanOrEqual(125); expect(target.y).toBeLessThanOrEqual(535);
      }
      for (let a = 0; a < targets.length; a++) for (let b = a + 1; b < targets.length; b++) {
        expect(Math.hypot(targets[a]!.x - targets[b]!.x, targets[a]!.y - targets[b]!.y)).toBeGreaterThanOrEqual(48);
      }
    }
    world.dispose();
  });
  it('retains solid depth and perspective rather than flattening the authored mesh', () => {
    const world = new WorldScene(stage(), 0); world.resize();
    const bounds = new THREE.Box3().setFromObject(world.scene);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(2.5);
    const projectedWidth = (z: number): number => {
      const a = new THREE.Vector3(-1, 2, z).project(world.camera); const b = new THREE.Vector3(1, 2, z).project(world.camera);
      return Math.abs(b.x - a.x);
    };
    const ratio = projectedWidth(-10) / projectedWidth(10);
    expect(ratio).toBeGreaterThanOrEqual(0.65); expect(ratio).toBeLessThan(1);
    world.dispose();
  });
  it('flies from the map into a close run view and returns with deterministic seeking', () => {
    const host = stage(); const create = vi.spyOn(host.marbles, 'create');
    const world = new WorldScene(host, 0); world.resize();
    const rest = world.camera.matrixWorld.clone();
    world.film(0); expect(world.camera.matrixWorld.elements).toEqual(rest.elements);
    world.film(5);
    const marble = create.mock.results[0]!.value.mesh;
    const width = (): number => {
      const left = marble.position.clone().add(new THREE.Vector3(-0.3, 0, 0)).project(world.camera);
      const right = marble.position.clone().add(new THREE.Vector3(0.3, 0, 0)).project(world.camera);
      return left.distanceTo(right);
    };
    const closeWidth = width(); const closeCamera = world.camera.matrixWorld.clone();
    world.setYaw(0); expect(closeWidth / width()).toBeGreaterThan(1.8);
    expect(world.camera.matrixWorld.elements).toEqual(rest.elements);
    world.film(8); world.film(5); expect(world.camera.matrixWorld.elements).toEqual(closeCamera.elements);
    world.film(world.machine.route.duration); expect(world.camera.matrixWorld.elements).toEqual(rest.elements);
    world.dispose();
  });
  it('keeps each authored reduced-motion shot fixed while cargo and linkages continue', () => {
    const world = new WorldScene(stage(), 0); world.resize();
    expect(world.plan).toBe(world.machine.route.plan);
    for (const shot of world.filmShots) {
      world.film(shot.start + 0.01, false); const camera = world.camera.matrixWorld.clone();
      world.film(shot.end - 0.01, false); expect(world.camera.matrixWorld.elements).toEqual(camera.elements);
    }
    world.dispose();
  });
  it('borrows one marble across successive film frames and releases it at teardown', () => {
    const host = stage(); const create = vi.spyOn(host.marbles, 'create'); const release = vi.spyOn(host.marbles, 'release');
    const world = new WorldScene(host, 0); world.resize(); world.film(0.5, false); world.film(1, false);
    expect(create).toHaveBeenCalledTimes(1); expect(host.draw).toHaveBeenCalledTimes(2);
    world.stopFilm(); world.dispose(); expect(release).toHaveBeenCalledTimes(1);
  });
});
