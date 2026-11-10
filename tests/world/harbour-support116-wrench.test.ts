// Real selected116 construction; root115 authored-origin/ground-reference regression.
import { expect, it } from 'vitest';
import { captureHarbourPiles105 } from './harbour-pile105';
import { StaticWrenchPath } from '../../src/view/static-support-graph';
import { nativeFacets } from '../../src/view/static-support-native';

it('rebuilds authored-origin reactions from a real ground reference and rejects incomplete triples', () => {
  const f = captureHarbourPiles105();
  try {
    const inspection = f.machine.staticSupportInspection()!;
    const certificate = inspection.certificate!;
    const path = new StaticWrenchPath(certificate);
    const totals = new Float64Array(certificate.islands.length * 6);
    const atGround = new Float64Array(totals.length);
    const load = { body: 'station-4', point: [2, 0, 3] as const,
      forceOrImpulse: [0, -1, 0] as const, couple: [.5, .25, .125] as const };
    path.transmit('force', [load], totals);
    path.allocateToGround('force', totals, atGround);
    expect(path.totalReference).toBe('authored-origin');
    const island = certificate.islands.findIndex(c => c.bodies.includes('station-4'));
    const j = island * 6, r = path.reactionGroundOrigins[island]!;
    const ground = path.reactionGroundIds[island]!;
    const range = inspection.native.find(p => p.id === ground)!;
    const domain = certificate.edges.find(e => e.kind === 'ground-weld' && e.a === ground)!
      .details as { readonly facets: readonly number[] };
    const native = nativeFacets(range);
    expect(domain.facets.some(t => native[t]!.some(p => p.every((x, k) => Object.is(x, r[k]))))).toBe(true);
    expect(Array.from(totals.slice(j, j + 6))).toEqual([0, 1, 0, -3.5, -.25, 1.875]);
    const force = Array.from(atGround.slice(j, j + 3));
    const rebuilt = [
      atGround[j + 3]! + r[1] * force[2]! - r[2] * force[1]!,
      atGround[j + 4]! + r[2] * force[0]! - r[0] * force[2]!,
      atGround[j + 5]! + r[0] * force[1]! - r[1] * force[0]!,
    ];
    rebuilt.forEach((v, k) => expect(Math.abs(v - totals[j + 3 + k]!))
      .toBeLessThanOrEqual(8 * Number.EPSILON * Math.max(1, Math.abs(v))));

    const sparse = new Array<number>(3); sparse[0] = 0; sparse[2] = 0;
    for (const field of ['point', 'forceOrImpulse', 'couple'] as const) {
      for (const bad of [[], [0, 0], sparse, [0, NaN, 0]]) {
        expect(() => path.transmit('force', [{ ...load, [field]: bad } as unknown as typeof load], totals)).toThrow();
      }
    }
    path.transmit('impulse', [{ ...load, forceOrImpulse: [0, 1, 0] }], totals);
    path.allocateToGround('impulse', totals, atGround);
    expect(Array.from(totals.slice(j, j + 6))).toEqual([0, -1, 0, 2.5, -.25, -2.125]);
  } finally {
    f.dispose();
  }
},60000);
