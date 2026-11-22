import { describe, expect, it } from 'vitest';
import { RoundedCircuit } from '../../src/engine/belt-path';

const rectangle = [[0, 0], [8, 0], [8, 5], [0, 5]] as const;
const notched = [[0, 0], [8, 0], [8, 3], [5, 3], [4, 6], [0, 6]] as const;

describe('rounded flat belt circuits', () => {
  it('follows the first edge from its outgoing tangent and rounds all four corners at the requested radius', () => {
    const path = new RoundedCircuit(rectangle, 1);
    expect(path.length).toBeCloseTo(26 - 8 + 2 * Math.PI, 12);
    expect(path.point(0)).toEqual({ x: 1, y: 0, z: 0, tx: 1, tz: 0 });
    expect(path.point(path.length)).toEqual(path.point(0));
    const middle = path.point(6 + Math.PI / 4);
    expect(middle.x).toBeCloseTo(7 + Math.SQRT1_2, 12);
    expect(middle.z).toBeCloseTo(1 - Math.SQRT1_2, 12);
    expect(middle.tx).toBeCloseTo(Math.SQRT1_2, 12);
    expect(middle.tz).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it.each([notched, [...notched].reverse()].map(vertices => ({ vertices })))(
    'round-trips signed offsets on both sides of concave and convex bends in either winding', ({ vertices }) => {
      const path = new RoundedCircuit(vertices, 0.8);
      let left = false, right = false;
      for (let i = 0; i < 240; i++) {
        const d = i / 240 * path.length;
        const p = path.point(d), next = path.point(d + 0.001);
        const turn = p.tx * next.tz - p.tz * next.tx;
        left ||= turn > 0.0012;
        right ||= turn < -0.0012;
        expect(Math.abs(turn)).toBeLessThanOrEqual(0.001 / 0.8 + 1e-12);
        expect(Math.hypot(next.x - p.x, next.z - p.z)).toBeCloseTo(0.001, 8);
        for (const offset of [-0.32, 0.32]) {
          const q = path.point(d - path.length, offset);
          expect(q.y).toBe(0);
          expect(q.x).toBeCloseTo(p.x + offset * p.tz, 10);
          expect(q.z).toBeCloseTo(p.z - offset * p.tx, 10);
          const hit = path.nearest(q.x, q.z);
          const error = Math.abs(hit.distance - d);
          expect(Math.min(error, path.length - error)).toBeLessThan(1e-9);
          expect(hit.lateral).toBeCloseTo(offset, 10);
        }
      }
      expect(left && right).toBe(true);
    });

  it('limits the shared radius where adjacent fillets meet and keeps tangents continuous through the seam', () => {
    const path = new RoundedCircuit([[0, 0], [2, 0], [2, 4], [0, 4]], 8);
    expect(path.length).toBeCloseTo(4 + 2 * Math.PI, 12);
    for (const join of [0, Math.PI / 2, Math.PI / 2 + 2, Math.PI + 2]) {
      const a = path.point(join - 1e-6), b = path.point(join + 1e-6);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(2e-6, 11);
      expect(Math.hypot(b.tx - a.tx, b.tz - a.tz)).toBeLessThan(2.01e-6);
    }
  });

  it('finds the closest side of a notch and the closest corner from outside the circuit', () => {
    const path = new RoundedCircuit(notched, 0.8);
    const samples = Array.from({ length: 1024 }, (_, i) => path.point(i * path.length / 1024));
    for (const [x, z] of [[6.5, 5], [6, 4], [3, 2], [-10, 20], [11, -5], [15, 5]] as const) {
      const hit = path.nearest(x, z);
      const p = path.point(hit.distance);
      const error = Math.hypot(p.x - x, p.z - z);
      const sampled = Math.min(...samples.map(q => Math.hypot(q.x - x, q.z - z)));
      expect(error).toBeLessThanOrEqual(sampled + 1e-12);
      expect(Math.abs(hit.lateral)).toBeCloseTo(error, 10);
    }
  });

  it('scales an oblique circuit to the exact transport length', () => {
    const base = new RoundedCircuit(notched, 0.8);
    const scale = 18 / base.length;
    const path = new RoundedCircuit(notched.map(([x, z]) => [x * scale, z * scale]), 0.8 * scale);
    expect(path.length).toBeCloseTo(18, 12);
    for (let d = 0; d < base.length; d += 0.25) {
      const p = base.point(d), q = path.point(d * scale);
      expect(q.x).toBeCloseTo(p.x * scale, 11);
      expect(q.z).toBeCloseTo(p.z * scale, 11);
      expect(q.tx).toBeCloseTo(p.tx, 11);
      expect(q.tz).toBeCloseTo(p.tz, 11);
    }
  });

  it('keeps an extra collinear vertex on its straight and rejects coincident edges and U-turns', () => {
    const path = new RoundedCircuit([[0, 0], [4, 0], ...rectangle.slice(1)], 1);
    expect(path.length).toBeCloseTo(new RoundedCircuit(rectangle, 1).length, 12);
    expect(path.point(3)).toMatchObject({ x: 4, z: 0, tx: 1, tz: 0 });
    expect(() => new RoundedCircuit([...rectangle, [0, 0]], 1)).toThrow();
    expect(() => new RoundedCircuit([[0, 0], [1, 0], [0.5, 0], [0, 2]], 1)).toThrow();
  });
});
