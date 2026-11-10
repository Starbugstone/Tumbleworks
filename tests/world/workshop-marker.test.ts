import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Stage } from '../../src/engine/stage';
import { TestWorldScene as WorldScene } from './cinematic-scene-fixture';

const distanceToStem = (point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const along = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - a.x - along * dx, point.y - a.y - along * dy);
};

it.each([[375, 690], [1280, 800]])('keeps the Workshop hammer separate from stop targets and stems at %sx%s', (width, height) => {
  const stage = { canvas: { clientWidth: width, clientHeight: height }, renderer: { setSize: vi.fn() },
    rect: { left: 0, top: 0, width, height }, createScene: () => new THREE.Scene(), disposeScene: (scene: THREE.Scene) => scene.clear(),
  } as unknown as Stage;
  const world = new WorldScene(stage, 0); world.resize();
  try {
    for (const yaw of [-15, -10, -5, 0, 5, 10, 15].map(degrees => degrees * Math.PI / 180)) {
      world.setYaw(yaw);
      const { badge } = world.workshopTargets(), stops = world.targets(), ground = world.groundTargets();
      expect(badge.x - 22).toBeGreaterThanOrEqual(8); expect(badge.x + 22).toBeLessThanOrEqual(width - 8);
      expect(badge.y - 22).toBeGreaterThan(120); expect(badge.y + 22).toBeLessThan(height - 120);
      for (const [index, stop] of stops.entries()) {
        expect(Math.hypot(badge.x - stop.x, badge.y - stop.y)).toBeGreaterThanOrEqual(52);
        expect(distanceToStem(badge, stop, ground[index]!)).toBeGreaterThanOrEqual(30);
      }
    }
  } finally { world.dispose(); }
});
