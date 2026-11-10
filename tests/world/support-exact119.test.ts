import { it, expect } from 'vitest';
import { q, exact, add, sub, mul, storedPoints, exact as storedExact, withExactNumbers, closed, type Tri, type V } from '../../src/view/support-exact';
import { exactPlaneSide, assertSimpleSolid, properSolidCross } from '../../src/view/support-solid';
import * as R from './painted-land-rational';

const sign = (a: R.R) => R.cmp(a, R.rat(0n));
function planeSide(t: Tri, p: V) {
  const v = (a: V, b: V) => a.map((x, i) => R.sub(R.exact(x), R.exact(b[i]!)));
  const a = v(t[1], t[0]), b = v(t[2], t[0]), c = v(p, t[0]);
  return sign(a.reduce((s, _, i) => {
    const j = (i + 1) % 3, k = (i + 2) % 3;
    return R.add(s, R.mul(R.sub(R.mul(a[j]!, b[k]!), R.mul(a[k]!, b[j]!)), c[i]!));
  }, R.rat(0n)));
}

it('normalizes rational fast paths exactly like the independent Euclidean oracle', () => {
  for (const n of [0n, 1n, -3n, (1n << 191n) + 1n, -(1n << 212n)]) {
    for (const d of [1n, 3n, -7n, 1n << 149n, (1n << 189n) + 3n]) {
      const a = q(n, d), b = q(7n, 1n << 23n);
      expect(a).toEqual(R.rat(n, d));
      for (const [op, ref] of [[add, R.add], [sub, R.sub], [mul, R.mul]] as const) expect(op(a, b)).toEqual(ref(a, b));
    }
  }
  expect(() => q(1n, 0n)).toThrow();
});

it('retains every stored dyadic including signed zero, subnormals and exponent extremes', () => {
  const values = [-0, 0, 2 ** -149, -(2 ** -149), Math.fround(2 ** 127), Math.fround(-(2 ** 127)), Math.fround(.1)];
  for (const x of values) {
    const s = storedPoints([[x, 2 ** -149, 0]])!;
    for (let i = 0; i < 3; i++) {
      const n = s.points[0]![i]!, r = s.exponent < 0 ? R.rat(n, 1n << BigInt(-s.exponent)) : R.rat(n << BigInt(s.exponent));
      expect(r).toEqual(R.exact([x, 2 ** -149, 0][i]!));
    }
  }
  expect(storedPoints([[.1, 0, 0]])).toBeUndefined();
  expect(storedPoints([[Infinity, 0, 0]])).toBeUndefined();
  withExactNumbers(() => { expect(storedExact(-0)).toEqual(exact(0)); expect(Object.isFrozen(exact(.1))).toBe(true); });
  expect(Object.isFrozen(exact(.1))).toBe(false);
});

it('certified signs match independent rational determinants at coplanar, tiny and cancellation boundaries', () => {
  const triangles: Tri[] = [
    [[0,0,0],[1,1,0],[0,1,1]],
    [[1,1,1],[1+2**-23,1,1],[1,1+2**-23,1]],
    [[0,0,0],[2**-149,0,0],[0,2**-149,0]],
    [[2**127,0,0],[0,2**127,0],[0,0,2**127]],
    [[.1,.2,.3],[.4,.7,.9],[.3,.11,.71]],
  ];
  let seed = 119;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return Math.fround((seed/2**32-.5)*32); };
  for (let i=0;i<128;i++) triangles.push(Array.from({length:3},()=>[random(),random(),random()]) as unknown as Tri);
  for (const t of triangles) for (const p of [...t, [0,0,0], [1,1,1+2**-23], [2**-149,2**-149,2**-149]] as V[]) expect(exactPlaneSide(t,p)).toBe(planeSide(t,p));
});

it('keeps exposed duplicates and strict crossings while rejecting only exact separations', () => {
  const a: Tri = [[0,0,0],[1,0,0],[0,1,0]];
  expect(() => assertSimpleSolid([a,a])).toThrow(/duplicate/);
  const b: Tri = [[.25,.25,-1],[.25,.25,1],[.75,.25,0]];
  expect(properSolidCross(a,b)).toBe(true);
  expect(() => assertSimpleSolid([a,b])).toThrow(/intersection/);
  for (const gap of [2**-149,2**-23,.1]) expect(() => assertSimpleSolid([a, a.map(p=>[p[0],p[1],gap]) as unknown as Tri])).not.toThrow();
  const tetra: Tri[] = [[[0,0,0],[0,1,0],[1,0,0]],[[0,0,0],[1,0,0],[0,0,1]],[[0,0,0],[0,0,1],[0,1,0]],[[1,0,0],[0,1,0],[0,0,1]]];
  expect(()=>closed(tetra)).not.toThrow();
  for (const f of [tetra.slice(1),[...tetra,tetra[0]!],tetra.map(t=>t.map(()=>[0,0,0]) as unknown as Tri)]) expect(()=>closed(f)).toThrow();
});

it('fails closed on nonfinite operands even when a shared vertex or edge would reject a finite pair', () => {
  const bad: Tri = [[Infinity,0,0],[0,1,0],[0,0,1]];
  expect(() => exactPlaneSide(bad,bad[0])).toThrow(/Nonfinite/);
  expect(() => properSolidCross(bad,bad)).toThrow(/Nonfinite/);
});
