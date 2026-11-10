import { Mesh } from 'three';
import { expect, it } from 'vitest';
import { villageWorld } from './village-world-fixture';

// Raw scopes: output/current/world-3d/combined-final-20261107T104422Z/world-summary.json.
// Geometry envelopes only; existing gameplay timing limits remain separate.
const ENVELOPES = { map: { meshes: 29, triangles: 36_160 }, film: { meshes: 30, triangles: 37_224 } } as const;

it.each([0, 1, 2, 3, 4, 5])('village %i fits the existing complete-scene geometry envelope with every earned reward', chapter => {
  const { world, probe, dispose } = villageWorld(chapter);
  try {
    expect(probe.machine.groups).toHaveLength(10);
    for (const phase of ['map', 'film'] as const) {
      if (phase === 'film') world.film(0);
      let meshes = 0, triangles = 0;
      world.scene.traverse(object => {
        if (!(object instanceof Mesh)) return;
        for (let ancestor: import('three').Object3D | null = object; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
        meshes++; triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      });
      expect(meshes, `${phase}: actual visible meshes before frustum culling`).toBeLessThanOrEqual(ENVELOPES[phase].meshes);
      expect(triangles, `${phase}: complete machine, landform, scenery, rewards and cargo`).toBeLessThanOrEqual(ENVELOPES[phase].triangles);
    }
  } finally { dispose(); }
});
