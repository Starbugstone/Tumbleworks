import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, Machine } from '../../src/machine/machine';
import { BOARDS } from '../../src/sim/boards';
import type { BoardDef } from '../../src/sim/types';

/**
 * The guarantees in docs/models/funnel-belt, checked on the real machine: whatever a player does, in
 * any order and at any moment. The model covers every interleaving of a tiny board; this covers real
 * boards and physics with arbitrary play. A failure names the seed, which reproduces it.
 */
beforeAll(initPhysics);

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function checkSlots(machine: Machine, label: string): void {
  const rules = machine.rules;
  const offsets = machine.riderOffsets();
  const slots = offsets.map((offset) => Math.round(offset / machine.slotPitch) % machine.board.beltCapacity);
  expect(new Set(slots).size, `${label}: two marbles hold one slot (${slots.join(',')})`).toBe(slots.length);
  expect(offsets.length, `${label}: rules and slots disagree`).toBe(rules.occupancy);
  expect(rules.occupancy, `${label}: over capacity`).toBeLessThanOrEqual(machine.board.beltCapacity);
  expect(machine.recoveries.bounces, `${label}: landing slot taken (${machine.lastRecovery})`).toBe(0);
  const statuses = rules.state.marbles.map((marble) => marble.status);
  const waiting = statuses.filter((status) => status === 'pouring').length;
  expect(waiting, `${label}: pile lost track of a marble`).toBe(rules.funnelCount);
  expect(statuses.length, `${label}: marble count changed`).toBe(machine.marbleIds.length);
}

function soak(board: BoardDef, seed: number, seconds: number): { undos: number; pours: number } {
  const roll = random(seed);
  const machine = new Machine(board);
  const beforePour: string[] = [];
  let undos = 0;
  let pours = 0;
  for (let tick = 0; tick < 60 * seconds; tick++) {
    const label = `${board.id} seed ${seed} tick ${tick}`;
    machine.step();
    checkSlots(machine, label);
    if (machine.rules.status === 'won') break;
    const dice = roll();
    if (dice < 0.02) {
      const before = machine.fingerprint();
      if (machine.tap(Math.floor(roll() * board.supplies.length)).ok) {
        beforePour.push(before);
        pours++;
      }
    } else if (dice < 0.026 && machine.canUndo) {
      expect(machine.undo()).toBe(true);
      expect(machine.fingerprint(), `${label}: undo did not restore the state before its pour`).toBe(beforePour.pop());
      checkSlots(machine, `${label} after undo`);
      undos++;
    }
  }
  machine.world.free();
  return { undos, pours };
}

describe('belt slots survive arbitrary play', () => {
  it.each([
    ['board-3', 1], ['board-9', 2], ['board-14', 3], ['board-22', 4], ['board-29', 5], ['board-30', 6],
  ])('%s seed %i', (id, seed) => {
    const board = BOARDS.find((candidate) => candidate.id === id);
    if (!board) throw new Error(id);
    const { undos, pours } = soak(board, seed, 45);
    expect(pours).toBeGreaterThan(0);
    expect(undos).toBeGreaterThan(0);
  }, 120_000);
});
