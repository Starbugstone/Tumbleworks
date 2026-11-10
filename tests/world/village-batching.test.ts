import { Group, Matrix4, MeshBasicMaterial, Vector3 } from 'three';
import { expect, it, vi } from 'vitest';
import { VillageMachine } from '../../src/view/village-machine';
import { CLOCKMAKERS_HILL } from '../../src/world/villages/clockmakers-hill';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { solidProbes, sphereCollision } from './village-geometry';

it('initializes manual support transforms so batched and individual parts agree before the first draw', () => {
  const source = CLOCKMAKERS_HILL, terrain = compileTerrain(source.terrain), material = new MeshBasicMaterial();
  const prototypes = VillageMachine.prototype as unknown as { merge(group: Group): void };
  const create = () => new VillageMachine(source.plan, { model: () => new Group() }, material,
    (x, z) => terrainHeightAt(terrain, x, z));
  const merged = create();
  const batching = vi.spyOn(prototypes, 'merge').mockImplementation(() => undefined);
  let individual: VillageMachine;
  try { individual = create(); } finally { batching.mockRestore(); }
  try {
    // No artificial full-scene matrix update here: both constructors must be ready
    // for the same read-only contact/bounds queries used by the camera and guards.
    let manualTransforms = 0;
    individual.root.traverse(object => {
      if (!(object instanceof Group) || object.matrixAutoUpdate) return;
      object.updateWorldMatrix(true, false);
      const expected = object.parent ? new Matrix4().multiplyMatrices(object.parent.matrixWorld, object.matrix) : object.matrix;
      expect(object.matrixWorld.elements, 'manual part transform must be ready before the first draw').toEqual(expected.elements);
      manualTransforms++;
    });
    expect(manualTransforms).toBeGreaterThan(1);
    const a = solidProbes(merged.root, 0.3), b = solidProbes(individual.root, 0.3);
    const point = new Vector3();
    for (const time of [0, 4, 6.7, 8.833333333333334, 15.4, 18]) {
      merged.apply(time); individual.apply(time); merged.sample(time, point);
      const left = sphereCollision(a, point, 0.3), right = sphereCollision(b, point, 0.3);
      expect(right === null, `batching changed physical clearance at ${time}`).toBe(left === null);
      if (left && right) expect(right.distance).toBeCloseTo(left.distance, 5);
    }
  } finally { merged.dispose(); individual.dispose(); material.dispose(); }
});
