import { expect, it } from 'vitest';
import { compileMovingRoll, sampleLocal, type SurfaceDrive, type SurfaceMotion } from '../../src/world/village-moving-contact';

const mechanics = { mass: 1, radius: .3, inertiaFactor: 1.4, gravity: 9.81, friction: .8 };
function fixedSlope(angle: number): SurfaceDrive {
  return { sourceId: 'gravity', acceptsOutlet: () => true, sample: () => ({
    origin: [0, 2, 0], tangent: [Math.cos(angle), Math.sin(angle), 0], normal: [-Math.sin(angle), Math.cos(angle), 0],
    originVelocity: [0, 0, 0], originAcceleration: [0, 0, 0], angularVelocity: [0, 0, 0], angularAcceleration: [0, 0, 0],
  }) };
}
it('rolls through a real slope without a centre hold and conserves mechanical energy', () => {
  const run = compileMovingRoll(fixedSlope(-.2), mechanics, { seconds: 0, x: -.8, velocity: 1 }, .8, 10);
  expect(run.exit.velocity ** 2).toBeCloseTo(1 + 2 * 9.81 * Math.sin(.2) * 1.6 / 1.4, 8);
  const first = run.rows[0]!.kineticPlusPotential;
  for (const row of run.rows) expect(row.kineticPlusPotential).toBeCloseTo(first, 8);
  const sample = { seconds: 0, x: 0, velocity: 0 };
  sampleLocal(run.rows, run.exit.seconds / 2, sample);
  expect(sample.velocity).toBeGreaterThan(1);
});
it('rejects an undocked outlet instead of retiming the moving tray', () => {
  const drive = { ...fixedSlope(-.2), acceptsOutlet: () => false };
  expect(() => compileMovingRoll(drive, mechanics, { seconds: 0, x: -.8, velocity: 1 }, .8, 10)).toThrow('not docked');
});
it('rejects an unsupported moving tray', () => {
  const base = fixedSlope(0);
  const drive: SurfaceDrive = { ...base, sample: t => ({ ...base.sample(t), originAcceleration: [0, -12, 0] }) };
  expect(() => compileMovingRoll(drive, mechanics, { seconds: 0, x: -.8, velocity: 1 }, .8, 10)).toThrow('loses marble support');
});
it('pays positive work when a translating floor accelerates the marble', () => {
  const drive: SurfaceDrive = { sourceId: 'finite-weight', acceptsOutlet: () => true,
    sample: (t): SurfaceMotion => ({ origin: [.1 * t * t, 2, 0], tangent: [1, 0, 0], normal: [0, 1, 0],
      originVelocity: [.2 * t, 0, 0], originAcceleration: [.2, 0, 0], angularVelocity: [0, 0, 0], angularAcceleration: [0, 0, 0] }) };
  const run = compileMovingRoll(drive, mechanics, { seconds: 0, x: -.8, velocity: 1 }, .8, 10);
  expect(run.suppliedMarbleWork).toBeGreaterThan(0);
  expect(run.exit.velocity).toBeLessThan(1);
});
