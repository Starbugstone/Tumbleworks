import { describe, expect, it } from 'vitest';
import terrainRaw from '../../assets/world-3d/terrain-runtime.json?raw';
import { RubeRoute, createRubeSample, createRubePose, rubePose, RUBE_DURATION } from '../../src/world/rube-sequence';
const anchors = (JSON.parse(terrainRaw).anchors as number[][]).map(p => ({ x: p[0]!, y: p[1]!, z: p[2]! }));
const route = new RubeRoute(anchors);
describe('causal Rube route', () => {
  it('joins every centre and keeps finite unit floor normals through vertical loops', () => {
    for (let i = 1; i < route.pieces.length; i++) {
      const a = route.pieces[i - 1]!.points.at(-1)!; const b = route.pieces[i]!.points[0]!;
      for (const key of ['x', 'y', 'z'] as const) expect(a[key]).toBeCloseTo(b[key], 8);
    }
    const sample = createRubeSample();
    for (let frame = 0; frame <= RUBE_DURATION * 60; frame++) {
      route.sample(frame / 60, sample);
      expect([sample.x, sample.y, sample.z, sample.nx, sample.ny, sample.nz, sample.distance].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(sample.nx, sample.ny, sample.nz)).toBeCloseTo(1, 7);
    }
    const loop = route.pieces.find(piece => piece.kind === 'loop')!;
    expect(Math.min(...loop.points.map(point => point.ny))).toBeLessThan(-0.99);
    expect(Math.max(...loop.points.map(point => Math.abs(point.ty)))).toBeGreaterThan(0.9);
  });
  it('gives each loop a sufficient preceding drop and only uses powered lifts to gain net height', () => {
    route.pieces.forEach((piece, index) => {
      const first = piece.points[0]!; const last = piece.points.at(-1)!;
      if (piece.loopDiameter) {
        const entry = route.pieces[index - 1]!.points[0]!;
        expect(entry.y - first.y).toBeGreaterThanOrEqual(piece.loopDiameter * 1.1);
      }
      if (!piece.powered) expect(last.y - first.y).toBeLessThanOrEqual(0.001);
    });
  });
  it('rounds every switchback with enough horizontal radius for the marble and channel', () => {
    const points = route.pieces.find(piece => piece.kind === 'zigzag')!.points;
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
      const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ac = Math.hypot(c.x - a.x, c.z - a.z);
      const twiceArea = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
      if (twiceArea > 1e-8) expect(ab * bc * ac / (2 * twiceArea)).toBeGreaterThan(0.55);
    }
  });
  it('moves no driven part before its contact and supports reverse seeking', () => {
    const rest = createRubePose(); rubePose(0, rest);
    for (const [key, before, after] of [['top', 8.099, 8.2], ['gear', 8.099, 8.2], ['gate', 8.849, 9], ['weight', 10.299, 10.4], ['catapult', 10.549, 10.6], ['bucket', 14.699, 15], ['hammer', 22.299, 22.4], ['bell', 22.499, 22.6]] as const) {
      expect(rubePose(before, createRubePose())[key]).toBe(rest[key]);
      expect(rubePose(after, createRubePose())[key]).not.toBe(rest[key]);
    }
    const sample = createRubeSample(); const first = { ...route.sample(8.6, sample) };
    route.sample(22, sample); expect(route.sample(8.6, sample)).toEqual(first);
    expect(route.sample(8.5, sample).distance).toBe(route.sample(8.95, createRubeSample()).distance);
  });
});
