import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { registerWorldKit, WorldAssets } from '../../src/view/world-assets';
import { surfaceOverlaps, surfaceTriangles, type SurfaceTriangle } from './surface-overlap';

const EPSILON = 1e-5;
function color(face: SurfaceTriangle): string {
  const geometry = face.mesh.geometry;
  const vertex = geometry.getIndex()?.getX(face.index * 3) ?? face.index * 3;
  const colors = geometry.getAttribute('color');
  return [colors.getX(vertex), colors.getY(vertex), colors.getZ(vertex)].join(',');
}
function exposedOverlaps(all: SurfaceTriangle[]): { a: number; b: number; at: number[] }[] {
  const hit = new THREE.Vector3();
  return surfaceOverlaps(all).flatMap(({ a, b, point, polygon }) => {
    if (color(a) === color(b)) return [];
    // Templates stand on y=0: the foundation's underside is an intentional ground contact.
    if (a.normal.y < 0 && a.bounds.max.y <= EPSILON) return [];
    const samples = [point, ...polygon.map(vertex => point.clone().lerp(vertex, 0.8))];
    const exposed = samples.find(sample => {
      const ray = new THREE.Ray(sample.clone().addScaledVector(a.normal, EPSILON), a.normal);
      return !all.some(face => ray.intersectTriangle(face.a, face.b, face.c, false, hit) !== null);
    });
    return exposed ? [{ a: a.index, b: b.index, at: exposed.toArray().map(value => +value.toFixed(4)) }] : [];
  });
}
function triangle(z: number, colorIndex: number, points = [[0, 1], [1, 1], [0, 2]]): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([x, y]) => [x!, y!, z]), 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array(9).fill(colorIndex), 3));
  return new THREE.Mesh(geometry);
}
function check(...meshes: THREE.Mesh[]): ReturnType<typeof exposedOverlaps> {
  const root = new THREE.Group(); root.add(...meshes);
  try { return exposedOverlaps(surfaceTriangles(root)); }
  finally {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      if (!Array.isArray(mesh.material)) mesh.material.dispose();
    }
  }
}

describe('house wall and window surface separation', () => {
  it('detects overlapping faces but accepts depth separation, shared edges and hidden joints', () => {
    expect(check(triangle(0, 0), triangle(0, 1))).toHaveLength(1);
    expect(check(triangle(0, 0), triangle(0.004, 1))).toEqual([]);
    expect(check(triangle(0, 0), triangle(0, 1, [[1, 1], [1, 2], [0, 2]]))).toEqual([]);
    expect(check(triangle(0, 0), triangle(0, 1), triangle(0.004, 2))).toEqual([]);
  });
  for (const name of ['house-a', 'house-b']) it(`${name} has no exposed coplanar faces with different colours`, () => {
    registerWorldKit(readFileSync(process.env.HOUSE_KIT_PATH ?? 'assets/world-3d/kit-runtime.json', 'utf8'));
    const assets = new WorldAssets(); const material = new THREE.MeshBasicMaterial();
    try {
      const model = assets.model(name, material);
      expect(model.children).toHaveLength(1);
      const triangles = surfaceTriangles(model);
      expect(exposedOverlaps(triangles)).toEqual([]);
      // Corner posts leave the plaster side panels exposed instead of hiding them with timber slabs.
      for (const side of [-1, 1]) {
        const ray = new THREE.Ray(new THREE.Vector3(side * 2, 0.4, 0), new THREE.Vector3(-side, 0, 0));
        const hits = triangles.flatMap(face => {
          const hit = ray.intersectTriangle(face.a, face.b, face.c, true, new THREE.Vector3());
          return hit ? [{ distance: hit.distanceTo(ray.origin), color: color(face) }] : [];
        }).sort((a, b) => a.distance - b.distance);
        expect(hits.length).toBeGreaterThan(0);
        const expected = new THREE.Color(name === 'house-a' ? 0xf3e3c3 : 0xe9d9c0).toArray();
        const actual = hits[0]!.color.split(',').map(Number);
        expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 4));
      }
    } finally {
      assets.dispose(); material.dispose();
    }
  });
});
