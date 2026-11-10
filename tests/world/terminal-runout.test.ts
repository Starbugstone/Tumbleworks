import { expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, Triangle, Vector3 } from 'three';
import { spiralBowl, straight, terminalRunout } from '../../src/world/villages/author';
import { villageChannelGeometry } from '../../src/view/machine-primitives';
import { surfaceTriangles } from './surface-overlap';
import { capsulePenetrations } from './triangle-clearance';

const spiral = spiralBowl([9.6, 3.45, .5], 1.5, .7, Math.PI / 2, -1, .9, .50);
const kept = spiral.slice(0, -14);
const runout = terminalRunout(kept.at(-1)!, { previous: kept.at(-2)!, easement: .4, pad: .35, steps: 17 });

it('unwinds the bank and curvature onto one exact downhill chord without larger frame steps', () => {
  expect(runout[0]).toBe(kept.at(-1));
  const before = runout.at(-2)!, end = runout.at(-1)!;
  expect(before.tangent).toEqual(end.tangent);
  expect(before.normal).toEqual(end.normal);
  const t = new Vector3(...end.tangent), n = new Vector3(...end.normal);
  const delta = new Vector3(...end.position).sub(new Vector3(...before.position));
  expect(delta.length()).toBeCloseTo(.35, 13);
  expect(delta.clone().normalize().distanceTo(t)).toBeLessThan(1e-13);
  expect(t.dot(n)).toBeCloseTo(0, 14);
  expect(t.y).toBeLessThan(0);
  expect(new Vector3().crossVectors(t, n).y).toBeCloseTo(0, 14);
  const step = (points: typeof spiral, key: 'normal' | 'tangent') => Math.max(...points.slice(1).map((p, i) =>
    new Vector3(...p[key]).distanceTo(new Vector3(...points[i]![key]))));
  expect(step(runout, 'normal')).toBeLessThan(step(spiral, 'normal'));
  expect(step(runout, 'tangent')).toBeLessThan(step(spiral, 'tangent'));
  const heading = (i: number) => Math.atan2(runout[i]!.tangent[2], runout[i]!.tangent[0]);
  const bank = (i: number) => {
    const p = runout[i]!, h = Math.hypot(p.tangent[0], p.tangent[2]);
    const side = new Vector3(-p.tangent[2] / h, 0, p.tangent[0] / h);
    const up = new Vector3(-p.tangent[0] * p.tangent[1] / h, h, -p.tangent[2] * p.tangent[1] / h);
    return Math.atan2(new Vector3(...p.normal).dot(side), new Vector3(...p.normal).dot(up));
  };
  const curvature = (heading(1) - heading(0)) / (1 - .5 / 17);
  for (let i = 1; i < 17; i++) {
    const u = (i + .5) / 17;
    expect((heading(i + 1) - heading(i)) / (1 - u)).toBeCloseTo(curvature, 12);
    expect(Math.tan(bank(i)) / (1 - i / 17)).toBeCloseTo(Math.tan(bank(0)), 12);
  }
});

it('the actual unwinding floor clears every swept sphere chord; the old diagonal loft fails', () => {
  const points = [...kept, ...runout.slice(1)], material = new MeshBasicMaterial();
  const inspect = (refine: boolean) => {
    const geometry = villageChannelGeometry(points, 'terracotta', undefined, refine);
    const mesh = new Mesh(geometry, material), faces = surfaceTriangles(mesh).map(f => ({
      triangle: new Triangle(f.a, f.b, f.c), bounds: f.bounds.clone().expandByScalar(.3), name: 'actual-terminal-floor',
    }));
    try {
      return points.slice(1).flatMap((p, i) => {
        const hit = capsulePenetrations(new Vector3(...points[i]!.position), new Vector3(...p.position), faces, .3);
        return hit ? [{ index: i, ...hit }] : [];
      });
    } finally { geometry.dispose(); }
  };
  try { expect(inspect(false).length).toBeGreaterThan(0); expect(inspect(true)).toEqual([]); }
  finally { material.dispose(); }
});

it('does not refine an already planar receiving floor', () => {
  const points = straight([0, 3, 0], [2, 2.8, 0]);
  const a = villageChannelGeometry(points, 'terracotta'), b = villageChannelGeometry(points, 'terracotta', undefined, true);
  try {
    expect(b.getAttribute('position').array).toEqual(a.getAttribute('position').array);
    expect(b.index!.array).toEqual(a.index!.array);
  } finally { a.dispose(); b.dispose(); }
});
