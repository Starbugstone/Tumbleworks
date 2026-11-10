import { describe, expect, it } from 'vitest';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { cardNeed, placeLane, ROSTER, rosterLayout } from '../../src/loop/roster-layout';

const linesOf = (board: (typeof LOOP_BOARDS)[number]): number[][] => board.lanes.map((line) => line.map((truck) => truck.segments.length + (truck.segments.reduce((sum, s) => sum + s.count, 0) < (truck.capacity ?? board.truckCapacity) ? 1 : 0)));
/** Levels that do not exist yet: later levels will have more lanes and longer queues. */
const invented = (lanes: number, depth: number, stretches: number): number[][] => Array.from({ length: lanes }, () => Array.from({ length: depth }, () => stretches));
const phone = { width: 375, height: 690 };
/** The game reserves a chip slot on every card when any truck is latched or linked (LoopRoster.hasRuleChips). */
const chips = (board: (typeof LOOP_BOARDS)[number]): boolean => Boolean(board.couplings?.length) || board.lanes.flat().some((truck) => Boolean(truck.pourAfter));

describe('the lorry card layout', () => {
  const shapes: [string, number[][], boolean][] = [...LOOP_BOARDS.map((board): [string, number[][], boolean] => [board.id, linesOf(board), chips(board)]), ['6 lanes of 4', invented(6, 4, 4), false], ['8 lanes of 5', invented(8, 5, 4), false], ['8 lanes of 8', invented(8, 8, 5), false]];

  for (const [name, lines, ruleChips] of shapes) {
    it(`${name}: fits the player's phone with the toy, readable numbers and a real tap target`, () => {
      const layout = rosterLayout(lines, phone.width, phone.height, ruleChips);
      expect(layout.numberSize).toBeGreaterThanOrEqual(11);
      expect(layout.rowHeight).toBeGreaterThanOrEqual(40);
      expect(layout.toy.height).toBeGreaterThanOrEqual(ROSTER.toyFloor);
      expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(phone.height - ROSTER.bottom);
      expect(layout.toy.y + layout.toy.height).toBeLessThanOrEqual(layout.panel.y);
      for (const line of lines) {
        const placed = placeLane(line, layout);
        // The docked lorry and the next one always keep their numbers; the rest may fold, and none is lost.
        expect(placed.cards.length).toBe(Math.min(line.length, Math.max(2, placed.cards.length)));
        const folded = placed.foldedFrom === null ? 0 : line.length - placed.foldedFrom;
        expect(placed.cards.length + folded).toBe(line.length);
        const last = placed.cards.at(-1)!;
        const right = folded ? placed.foldX + ROSTER.foldWidth : last.x + last.width;
        expect(right).toBeLessThanOrEqual(layout.cardsWidth + 0.5);
      }
    });
  }

  it('folds lorries on the player’s phone only in lanes four or more deep', () => {
    for (const board of LOOP_BOARDS) {
      const layout = rosterLayout(linesOf(board), phone.width, phone.height, chips(board));
      for (const line of linesOf(board)) if (line.length < 4) expect(placeLane(line, layout).foldedFrom, board.id).toBeNull();
    }
  });

  it('gives cards room for their numbers on every current level', () => {
    for (const board of LOOP_BOARDS) {
      const layout = rosterLayout(linesOf(board), phone.width, phone.height, chips(board));
      for (const line of linesOf(board)) {
        for (const card of placeLane(line, layout).cards) {
          const stretches = line[card.truck]!;
          expect(card.width + 0.5, board.id).toBeGreaterThanOrEqual(cardNeed(stretches, card.truck === 0 ? ROSTER.cabNow : ROSTER.cabWaiting));
        }
      }
    }
  });

  it('gives way in order as a level grows: the toy first, then row height, then folding', () => {
    const toy = (lanes: number): number => rosterLayout(invented(lanes, 2, 3), phone.width, phone.height).toy.height;
    expect(toy(2)).toBeGreaterThan(toy(4));
    expect(toy(4)).toBeGreaterThan(toy(6));
    // Folding only starts when a line no longer fits.
    const short = rosterLayout(invented(4, 2, 3), phone.width, phone.height);
    expect(placeLane([3, 3], short).foldedFrom).toBeNull();
    const long = rosterLayout(invented(4, 6, 3), phone.width, phone.height);
    const placed = placeLane([3, 3, 3, 3, 3, 3], long);
    expect(placed.foldedFrom).not.toBeNull();
    expect(placed.cards.length).toBeGreaterThanOrEqual(2);
  });

  it('moves the cards beside the toy on wide screens', () => {
    for (const [width, height] of [[1365, 900], [1280, 800]] as const) {
      const layout = rosterLayout(invented(4, 2, 3), width, height);
      expect(layout.wide).toBe(true);
      expect(layout.toy.x + layout.toy.width).toBeLessThanOrEqual(layout.panel.x);
      expect(layout.toy.height).toBeGreaterThan(200);
    }
  });
});

// Latches reserve a separate badge column; percentages keep their minimum width.
it('feature lessons reserve latch room without shrinking card numbers or tap targets', () => {
  for (const board of LOOP_BOARDS.filter((candidate) => Number(candidate.id.slice(5)) >= 200)) {
    const lines = linesOf(board);
    const latch = board.lanes.flat().some((truck) => Boolean(truck.pourAfter));
    const layout = rosterLayout(lines, 375, 690, latch);
    expect(layout.ruleWidth).toBe(latch ? 26 : 0);
    for (const line of lines) for (const card of placeLane(line, layout).cards) {
      expect(card.width - layout.ruleWidth).toBeGreaterThanOrEqual(cardNeed(line[card.truck]!, card.truck ? ROSTER.cabWaiting : ROSTER.cabNow));
    }
    expect(layout.numberSize).toBe(13);
    expect(layout.rowHeight).toBeGreaterThanOrEqual(40);
  }
});

it('short card beds shrink without reducing the cab or the number and touch floors', () => {
  const layout = rosterLayout([[3], [3]], 375, 690);
  const short = placeLane([3], layout, [0.5]).cards[0]!;
  const full = placeLane([3], layout, [1]).cards[0]!;
  expect(short.width).toBeLessThan(full.width);
  expect(short.width).toBeGreaterThanOrEqual(cardNeed(3, ROSTER.cabNow));
  expect(layout.rowHeight).toBeGreaterThanOrEqual(40);
});

it('never latches a linked truck: the padlock and the coupling bar would meet on the tailboard', () => {
  for (const board of LOOP_BOARDS) {
    const linked = new Set((board.couplings ?? []).flat());
    board.lanes.forEach((line, lane) => line.forEach((truck, index) => {
      const id = truck.id ?? `${lane}:${index}`;
      expect(Boolean(truck.pourAfter && linked.has(id)), `${board.id} ${id}`).toBe(false);
    }));
  }
});
