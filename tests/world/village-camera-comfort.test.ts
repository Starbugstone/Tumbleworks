import { writeFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { afterAll, expect, it } from 'vitest';
import { villageWorld } from './village-world-fixture';

interface Trace {
  viewport: readonly [number, number];
  duration: number;
  inwardExcursions: number;
  samples: readonly { seconds: number; inverseDepth: number }[];
}
const traces: Trace[] = [];

// Hysteresis measures perceptible changes in the marble's projected scale,
// including a physical camera dolly when camera.zoom itself stays at one.
function inwardExcursions(scales: readonly number[]): number {
  let valley = scales[0]!, peak = valley, approaching = false, count = 0;
  for (const scale of scales) {
    if (approaching) {
      peak = Math.max(peak, scale);
      if (scale < peak / 1.08) { approaching = false; valley = scale; }
    } else {
      valley = Math.min(valley, scale);
      if (scale > valley * 1.08) { approaching = true; peak = scale; count++; }
    }
  }
  return count;
}

afterAll(() => {
  const file = process.env.TUMBLEWORKS_CAMERA_TRACE;
  if (file) writeFileSync(file, JSON.stringify({ scope: 'Camera scale only; geometry and phone performance not proven', traces }, null, 2), { flag: 'wx' });
});

for (const viewport of [[375, 690], [1280, 800]] as const) {
  it(`the complete Gardens film has at most two deliberate framing approaches at ${viewport.join('x')}`, () => {
    const { world, probe, resize, dispose } = villageWorld(1);
    try {
      resize(viewport[0], viewport[1]);
      const duration = probe.machine.route.duration;
      const frames = Math.ceil(duration * 120), direction = new Vector3(), delta = new Vector3();
      const samples: { seconds: number; inverseDepth: number }[] = [];
      for (let frame = 0; frame <= frames; frame++) {
        const seconds = duration * frame / frames;
        world.film(seconds);
        world.camera.getWorldDirection(direction);
        const depth = delta.copy(probe.marble!.mesh.position).sub(world.camera.position).dot(direction);
        expect(depth).toBeGreaterThan(0);
        samples.push({ seconds, inverseDepth: 1 / depth });
      }
      const count = inwardExcursions(samples.map(sample => sample.inverseDepth));
      traces.push({ viewport, duration, inwardExcursions: count, samples });
      expect(count, 'Repeated projected marble growth/shrink reveals camera breathing, even at fixed lens zoom').toBeLessThanOrEqual(2);
      const depths = samples.filter(sample => sample.seconds >= 4 && sample.seconds <= duration - 4)
        .map(sample => 1 / sample.inverseDepth);
      const middle = (Math.min(...depths) + Math.max(...depths)) / 2;
      for (const depth of depths) expect(Math.abs(depth / middle - 1), 'Hold-phase marble size stays within three percent').toBeLessThanOrEqual(0.03);
      if (viewport[0] === 375) expect(middle, 'Keep the marble readable in the stable phone framing').toBeLessThanOrEqual(48);
    } finally { dispose(); }
  });
}

it('counts seven scale pulses and a single establishing move independently of the camera implementation', () => {
  expect(inwardExcursions([1, 1.2, 1, 1.2, 1, 1.2, 1, 1.2, 1, 1.2, 1, 1.2, 1, 1.2, 1])).toBe(7);
  expect(inwardExcursions([1, 1.04, 1.12, 1.4, 1.8, 1.8, 1.4, 1.12, 1.04, 1])).toBe(1);
});
