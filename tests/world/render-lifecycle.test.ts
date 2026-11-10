import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { MarbleFactory } from '../../src/engine/marbles';
import type { Stage } from '../../src/engine/stage';
import { TestWorldScene as WorldScene } from './cinematic-scene-fixture';
import { worldProgress } from '../../src/world/progression';

it('a film borrows its plain marble from the shared owner and returns it before map/game scene disposal', () => {
  const marbles = new MarbleFactory();
  const disposeScene = vi.fn((scene: THREE.Scene) => {
    expect(marbles.count, 'pooled actors must be detached before scene materials are disposed').toBe(0);
    scene.clear();
  });
  // Geometry ownership needs no WebGL context; the browser tests separately prove its real draw and input.
  const stage = { marbles, canvas: { dataset: {}, clientWidth: 375, clientHeight: 690 },
    renderer: { setSize: vi.fn() }, rect: { left: 0, top: 0, width: 375, height: 690 },
    createScene: () => new THREE.Scene(), draw: vi.fn(), disposeScene } as unknown as Stage;
  const scene = new WorldScene(stage, 0);
  const levels = Array.from({ length: 10 }, (_, stop) => ['conveyor', 'loop', 'tube'].map(kind => ({ id: `${kind}-${stop}`, kind }))).flat();
  const chapter = worldProgress(levels, new Set(levels.map(level => level.id))).chapters[0]!;
  expect(marbles.count).toBe(0);
  scene.film(1);
  scene.film(2);
  expect(marbles.count, 'repeated frames share one actor').toBe(1);
  scene.update(chapter, false);
  expect(marbles.count, 'returning to the map releases the film actor').toBe(0);
  scene.film(3);
  expect(marbles.count).toBe(1);
  scene.dispose();
  expect(marbles.count).toBe(0);
  expect(disposeScene).toHaveBeenCalledOnce();
});
