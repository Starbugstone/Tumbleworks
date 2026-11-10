import { describe, expect, it } from 'vitest';
import { BOARDS, BOARD_200 } from '../../src/sim/boards';
import { BOARD_210, FUNNEL_VARIETY_BOARDS } from '../../src/sim/variety-boards';
import { MachineRules } from '../../src/sim/rules';
import { columnTap, shelfMarks } from '../../src/sim/shelf-marks';
import { settle } from '../../src/sim/solver';
import { FUNNEL_JAMS, FUNNEL_WITNESSES } from '../witnesses';
import { VARIETY_FUNNEL_JAMS, VARIETY_FUNNEL_WITNESSES } from '../variety-witnesses';

const shelfBoards = BOARDS.filter((board) => board.predecessors);
const orders = { ...FUNNEL_WITNESSES, ...VARIETY_FUNNEL_WITNESSES };
const jams = { ...FUNNEL_JAMS, ...VARIETY_FUNNEL_JAMS };

describe('shelf padlocks and straps', () => {
  it('covers every forked-shelf board', () => {
    expect(shelfBoards.map((board) => board.id)).toEqual(expect.arrayContaining(['board-78', 'board-201', 'board-210']));
  });

  it('shows the player-reported board as three padlocks: two straps on the shared crate, one on each of the others', () => {
    expect(shelfMarks(new MachineRules(BOARD_210))).toEqual({ locked: [1, 3, 5], straps: [[0, 1], [2, 1], [2, 3], [4, 5]] });
  });

  it('draws nothing on column or paired boards, whose queues slide forward', () => {
    expect(shelfMarks(new MachineRules(BOARDS[0]!))).toEqual({ locked: [], straps: [] });
    expect(shelfMarks(new MachineRules(BOARD_200))).toEqual({ locked: [], straps: [] });
  });

  for (const board of shelfBoards) for (const [kind, order] of [['win', orders[board.id]], ['jam', jams[board.id]]] as const) {
    it(`${board.id} ${kind}: a padlock means refused, and straps fall only with accepted releases`, () => {
      expect(order).toBeTruthy();
      const rules = new MachineRules(board);
      const ids = rules.state.supplies.flat().map((packet) => packet.id);
      for (const letter of order!) {
        const marks = shelfMarks(rules);
        const released = new Set(rules.state.released);
        for (const id of ids) {
          const padlocked = marks.locked.includes(id);
          expect(padlocked).toBe(!released.has(id) && !rules.accessible(id));
          // Every padlocked crate is strapped to something still in place, and every strap ends on a padlock.
          if (padlocked) expect(marks.straps.some(([, locked]) => locked === id)).toBe(true);
        }
        for (const [blocker, locked] of marks.straps) {
          expect(marks.locked).toContain(locked);
          expect(released.has(blocker)).toBe(false);
          expect(rules.predecessors(locked)).toContain(blocker);
        }
        for (const id of marks.locked) {
          const before = rules.snapshot();
          expect(rules.release(id).ok).toBe(false);
          expect(rules.snapshot()).toEqual(before);
        }
        const action = letter.charCodeAt(0) - 65;
        if (!rules.release(action).ok) break;
        const after = shelfMarks(rules);
        // The tipped crate's straps are gone at acceptance, before any marble has moved.
        expect(after.straps.some(([blocker]) => rules.state.released.includes(blocker))).toBe(false);
        settle(rules);
        if (rules.status !== 'playing') break;
      }
    });
  }
});

describe('paired boards keep column taps', () => {
  const paired = [...BOARDS, ...FUNNEL_VARIETY_BOARDS].filter((board) => board.pairs?.length && !board.predecessors);
  it('covers the paired lessons', () => {
    expect(paired.map((board) => board.id)).toEqual(expect.arrayContaining(['board-200', 'board-211']));
  });
  it('maps a back crate to its column front, and leaves shelf and front crates alone', () => {
    const rules = new MachineRules(BOARD_200);
    const fronts = rules.state.supplies.map((queue) => queue[0]!.id);
    for (const queue of rules.state.supplies) for (const packet of queue) expect(columnTap(rules, packet.id)).toBe(queue[0]!.id);
    for (const id of fronts) expect(columnTap(rules, id)).toBe(id);
    const shelves = new MachineRules(BOARD_210);
    for (const packet of shelves.state.supplies.flat()) expect(columnTap(shelves, packet.id)).toBe(packet.id);
  });
  for (const board of paired) it(`${board.id}: along its witness every visible crate's tap maps to a release the rules accept`, () => {
    const rules = new MachineRules(board);
    for (const letter of orders[board.id]!) {
      for (const packet of rules.state.supplies.flat()) {
        const target = columnTap(rules, packet.id);
        expect(rules.state.supplies.some((queue) => queue[0]?.id === target)).toBe(true);
      }
      expect(rules.release(columnTap(rules, letter.charCodeAt(0) - 65)).ok).toBe(true);
      settle(rules);
      if (rules.status !== 'playing') break;
    }
    expect(rules.status).toBe('won');
  });
});
