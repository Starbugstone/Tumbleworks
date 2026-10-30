import { beforeAll, expect, it } from 'vitest';
import { Machine, initPhysics } from '../../src/machine/machine';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import type { BoardDef } from '../../src/sim/types';

beforeAll(initPhysics);

/** A brisk player taps as soon as a tray is accepted. Returns seconds until the level is won. */
function brisk(board: BoardDef, order: string): number {
  const machine = new Machine(board);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  for (let tick = 0; tick < 60 * 120; tick++) {
    machine.step();
    if (machine.rules.status !== 'playing') break;
    const tap = taps[next];
    if (tap !== undefined && tick % 15 === 0 && machine.tap(tap).ok) next += 1;
  }
  expect(machine.rules.status).toBe('won');
  const seconds = machine.tick / 60;
  machine.world.free();
  return seconds;
}

it('levels stay quick for a brisk player', () => {
  const level1 = brisk(BOARD_1, 'AAB');
  const level2 = brisk(BOARD_2, 'ABABC');
  console.log(`brisk win: level 1 ${level1.toFixed(1)}s, level 2 ${level2.toFixed(1)}s`);
  expect(level1).toBeLessThan(21);
  expect(level2).toBeLessThan(30);
}, 120_000);
