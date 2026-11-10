import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Stage } from '../../src/engine/stage';
import { WorldKitAssets } from '../../src/view/world-kit';
import { TestWorldScene as WorldScene } from './startup-scene-fixture';
import { VILLAGE_DURATION, VILLAGE_RADIUS } from '../../src/world/village-plan';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';
import * as progress from '../../src/progress';

it('keeps the rolling marble clear of actual village and earned-project meshes across all six villages', () => {
  const completed = vi.spyOn(progress, 'completedLevels').mockReturnValue(WORKSHOP_PROJECTS.map(project => project.id));
  const load = WorldKitAssets.prototype.model;
  const records: { source: THREE.Group; copy: THREE.Group; name: string }[] = [];
  const models = vi.spyOn(WorldKitAssets.prototype, 'model').mockImplementation(function (this: WorldKitAssets, name, material) {
    const group = load.call(this, name, material);
    if (!name.startsWith('mechanism-')) records.push({ source: group, copy: group.clone(true), name });
    return group;
  });
  const point = new THREE.Vector3();
  const failures: { chapter: number; name: string; seconds: number; distance: number }[] = [];
  try {
    for (let chapter = 0; chapter < 6; chapter++) {
      records.length = 0;
      const stage = { createScene: () => new THREE.Scene(), disposeScene: (scene: THREE.Scene) => scene.clear() } as unknown as Stage;
      const world = new WorldScene(stage, chapter);
      try {
        const bounds = records.map(record => {
          record.source.updateWorldMatrix(true, false);
          record.copy.applyMatrix4(record.source.matrixWorld);
          return { name: record.name, box: new THREE.Box3().setFromObject(record.copy), minimum: Infinity, seconds: 0 };
        });
        for (let frame = 0; frame <= VILLAGE_DURATION * 24; frame++) {
          world.machine.sample(frame / 24, point);
          for (const bound of bounds) {
            const distance = bound.box.distanceToPoint(point);
            if (distance < bound.minimum) { bound.minimum = distance; bound.seconds = frame / 24; }
          }
        }
        for (const bound of bounds) if (bound.minimum < VILLAGE_RADIUS + 0.4) failures.push({ chapter, name: bound.name, seconds: bound.seconds, distance: bound.minimum });
      } finally { world.dispose(); }
    }
    expect(failures, 'the 3D path clears authored scenery and optional additions by at least 0.4 beyond the marble').toEqual([]);
  } finally { models.mockRestore(); completed.mockRestore(); }
});
