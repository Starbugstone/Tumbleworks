import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { counterweightGeometry } from '../../src/view/counterweight';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles } from './surface-overlap';

it.each([9, 5, 1])('Gardens weight %i has a real passage for its complete fixed guide', stop => {
  const { world, probe, dispose } = villageWorld(1, true);
  try {
    world.film(0);
    const weight = probe.machine.root.getObjectByName(`village-${stop}-weight`);
    if (!weight) throw new Error('Actual source weight missing');
    weight.updateWorldMatrix(true, true);
    const centre = weight.getWorldPosition(new Vector3());
    const triangles = surfaceTriangles(weight);
    const ray = new Ray(), hit = new Vector3();
    for (const x of [-.0175, 0, .0175]) for (const z of [-.0175, 0, .0175]) {
      ray.set(centre.clone().add(new Vector3(x, -.3, z)), new Vector3(0, 1, 0));
      const hits = triangles.filter(face => ray.intersectTriangle(face.a, face.b, face.c, false, hit)
        && hit.distanceTo(ray.origin) <= .6);
      expect(hits, `guide cross-section x=${x}, z=${z} intersects the weight`).toHaveLength(0);
    }
    // A passage must not be implemented by deleting the weight's material.
    ray.set(centre.clone().add(new Vector3(.1, -.3, .1)), new Vector3(0, 1, 0));
    expect(triangles.some(face => ray.intersectTriangle(face.a, face.b, face.c, false, hit)
      && hit.distanceTo(ray.origin) <= .6)).toBe(true);
  } finally { dispose(); }
});

it('the bored weight keeps its outer envelope and closes its material volume', () => {
  const geometry = counterweightGeometry();
  try {
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.getSize(new Vector3()).distanceTo(new Vector3(.38, .5, .38))).toBeLessThan(1e-7);
    const vertices = geometry.getAttribute('position');
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    let volume = 0;
    for (let i = 0; i < vertices.count; i += 3) {
      a.fromBufferAttribute(vertices, i); b.fromBufferAttribute(vertices, i + 1); c.fromBufferAttribute(vertices, i + 2);
      volume += a.dot(b.cross(c)) / 6;
    }
    expect(volume).toBeCloseTo((.38 ** 2 - .045 ** 2) * .5, 7);
  } finally { geometry.dispose(); }
});
