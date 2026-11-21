import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Stage } from '../../src/engine/stage';
import { separateMapPins } from '../../src/view/map-pins';
import { TestWorldScene as WorldScene } from './cinematic-scene-fixture';

it('keeps the ten stop targets separate and above the Workshop footer on an upright phone', () => {
  const width = 375, height = 690;
  const stage = {
    canvas: { clientWidth: width, clientHeight: height },
    renderer: { setSize: vi.fn() },
    rect: { left: 0, top: 0, width, height },
    createScene: () => new THREE.Scene(),
    disposeScene: (scene: THREE.Scene) => scene.clear(),
  } as unknown as Stage;
  const world = new WorldScene(stage, 0);
  world.resize();
  try {
    for (const dragX of [-30, -20, -10, 0, 10, 20, 30]) {
      world.resetView();
      world.orbit.rotate(dragX, 0);
      world.inspect();
      const pins = separateMapPins(world.targets(), width, height);
      expect(pins).toHaveLength(10);
      for (const [index, pin] of pins.entries()) {
        expect(pin.x - 22).toBeGreaterThanOrEqual(0);
        expect(pin.x + 22).toBeLessThanOrEqual(width);
        expect(pin.y - 22).toBeGreaterThan(90);
        expect(pin.y + 22).toBeLessThan(height - 120);
        for (const other of pins.slice(0, index)) {
          expect(Math.hypot(pin.x - other.x, pin.y - other.y)).toBeGreaterThanOrEqual(44);
        }
      }
    }
  } finally {
    world.dispose();
  }
});
