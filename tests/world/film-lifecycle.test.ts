import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Stage } from '../../src/engine/stage';
import { MarbleFactory } from '../../src/engine/marbles';
import { TestWorldFilm as WorldFilm } from './cinematic-scene-fixture';
import { TestWorldScene as WorldScene } from './cinematic-scene-fixture';
import { CONNECTION_SECONDS } from '../../src/world/film-timeline';
import { worldProgress } from '../../src/world/progression';

it.each([3.137, 31.019])('uses the authoritative %fs route for its local film and previous-village cut', duration => {
  for (const chapter of [0, 1]) {
    const stage = {
      canvas: { clientWidth: 375, clientHeight: 690 }, renderer: { setSize: vi.fn() },
      marbles: new MarbleFactory(), createScene: () => new THREE.Scene(), draw: vi.fn(),
      disposeScene: (scene: THREE.Scene) => scene.clear(),
    } as unknown as Stage;
    // Borrow the presentation boundary only; physical route correctness has its own guards.
    const current = { machine: { route: { duration } }, finishConstruction: vi.fn(), resize: vi.fn(),
      filmReadiness: () => 'ready', beginFilm: vi.fn(), film: vi.fn(), stopFilm: vi.fn(), dispose: vi.fn() } as unknown as WorldScene;
    const film = new WorldFilm(stage, chapter, current);
    try {
      expect(film.duration).toBe(duration + (chapter === 0 ? 0 : CONNECTION_SECONDS));
      film.render(duration - 0.000001);
      expect(current.film).toHaveBeenLastCalledWith(duration - 0.000001, true);
      film.render(duration);
      if (chapter === 0) expect(current.film).toHaveBeenLastCalledWith(duration, true);
      else {
        expect(current.film).toHaveBeenCalledTimes(1); expect(current.stopFilm).toHaveBeenCalledTimes(1);
        expect(stage.marbles.count).toBe(1);
      }
    } finally { film.dispose(); }
    expect(stage.marbles.count).toBe(0); expect(current.dispose).not.toHaveBeenCalled();
  }
});

it('finishes the earned final construction before seating the film marble in its cradle', () => {
  const stage = {
    canvas: { clientWidth: 375, clientHeight: 690 }, renderer: { setSize: vi.fn() },
    marbles: new MarbleFactory(), createScene: () => new THREE.Scene(), draw: vi.fn(),
    disposeScene: (scene: THREE.Scene) => scene.clear(),
  } as unknown as Stage;
  const world = new WorldScene(stage, 0);
  const levels = Array.from({ length: 10 }, (_, stop) => ['conveyor', 'loop', 'tube'].map(kind => ({ id: `${kind}-${stop}`, kind }))).flat();
  world.update(worldProgress(levels, new Set(levels.slice(0, 27).map(level => level.id))).chapters[0]!, false);
  world.update(worldProgress(levels, new Set(levels.map(level => level.id))).chapters[0]!, true);
  const cradle = world.scene.getObjectByName('village-stop-9')!;
  expect(world.constructionProgress).toBeLessThan(1);
  cradle.updateWorldMatrix(true, false); const assembling = cradle.matrixWorld.clone();
  const film = new WorldFilm(stage, 0, world);
  try {
    film.render(0); expect(world.constructionProgress).toBe(1);
    cradle.updateWorldMatrix(true, false); expect(cradle.matrixWorld.equals(assembling)).toBe(false);
    expect(cradle.getWorldScale(new THREE.Vector3()).toArray()).toEqual([1, 1, 1]);
  }
  finally { film.dispose(); world.dispose(); }
});

it('keeps the borrowed village alive and returns its actor before switching to the previous village', () => {
  const disposed: THREE.Scene[] = [];
  const stage = {
    canvas: { clientWidth: 375, clientHeight: 690 }, renderer: { setSize: vi.fn() },
    marbles: new MarbleFactory(), createScene: () => new THREE.Scene(), draw: vi.fn(),
    disposeScene: (scene: THREE.Scene) => { disposed.push(scene); scene.clear(); },
  } as unknown as Stage;
  const created = vi.spyOn(stage.marbles, 'create');
  const current = new WorldScene(stage, 1);
  const film = new WorldFilm(stage, 1, current);
  const duration = current.machine.route.duration;
  expect(film.duration).toBe(duration + CONNECTION_SECONDS);
  film.render(1);
  expect(stage.marbles.count).toBe(1);
  const firstActor = created.mock.results[0]!.value.mesh;
  expect(firstActor.parent).toBe(current.scene);
  film.render(duration - 0.000001);
  expect(firstActor.parent).toBe(current.scene);
  film.render(duration);
  expect(stage.marbles.count).toBe(1);
  expect(firstActor.parent).not.toBe(current.scene);
  film.render(duration + CONNECTION_SECONDS / 2);
  expect(stage.marbles.count).toBe(1);
  film.dispose();
  expect(stage.marbles.count).toBe(0);
  expect(disposed).toHaveLength(1);
  expect(disposed).not.toContain(current.scene);
  current.draw();
  expect(stage.draw).toHaveBeenLastCalledWith(current.scene, current.camera);
  current.dispose();
  expect(disposed).toHaveLength(2);
});
