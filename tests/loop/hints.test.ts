import { afterEach, expect, it } from 'vitest';
import type { ReplayLog } from '../../src/engine/replay';
import { LoopMachine } from '../../src/loop/machine';
import { LoopRuntime } from '../../src/gameplays/loop';
import { replayed } from '../replay-target';
import { setLocale } from '../../src/preferences';

afterEach(() => setLocale('en'));

const busyPour: ReplayLog = {
  version: 1, level: 'loop-39', steps: 0, fingerprint: '08319b9f',
  actions: [{ step: 0, type: 'tap', at: 0 }],
};

it.each([
  ['en', 'Wait for pouring and collecting. Hold ×5, then ask again.'],
  ['fr', 'Patientez pendant les transferts. Maintenez ×5, puis redemandez un indice.'],
] as const)('%s: a hint during the recorded pour explains how to wait without changing the game', (locale, text) => {
  setLocale(locale);
  const machine = replayed(busyPour);
  if (!(machine instanceof LoopMachine)) throw new Error('Expected a Loop Sort replay');
  expect(machine.fingerprint()).toBe(busyPour.fingerprint);
  expect(machine.rules.pending).toBeGreaterThan(0);
  const before = machine.fingerprint();
  const runtime: LoopRuntime = Object.create(LoopRuntime.prototype);
  Object.defineProperty(runtime, 'machine', { value: machine });
  const feedback = runtime.hint();
  expect(machine.fingerprint()).toBe(before);
  expect(feedback).toEqual([{ type: 'message', text }]);
});
