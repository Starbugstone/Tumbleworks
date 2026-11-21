import { expect, it } from 'vitest';
import { tubeRack } from '../../src/puzzles/tube-rack';
import { TUBE_BOARDS } from '../../src/puzzles/levels';

it('keeps the existing positions and extents of ordinary two-column boards', () => {
  for (const board of TUBE_BOARDS.filter(board => !board.rows)) {
    const rack = tubeRack(board);
    for (const [index, point] of rack.places.entries()) {
      const lastAlone = board.tubes.length % 2 === 1 && index === board.tubes.length - 1;
      expect(point).toEqual({ x: lastAlone ? 0 : (index % 2 - .5) * 3.8, z: (Math.floor(index / 2) - 1) * 4.8 });
    }
    expect(rack.halfWidth).toBeCloseTo(4.1);
  }
});

it('centres each authored row; the camera, touch and tracks share stable indices', () => {
  const board = TUBE_BOARDS.find(board => board.id === 'tube-41')!;
  expect(tubeRack(board).places).toEqual([
    { x: -1.9, z: -4.8 }, { x: 1.9, z: -4.8 }, { x: 0, z: 0 },
    { x: -1.9, z: 4.8 }, { x: 1.9, z: 4.8 },
  ]);
  const wide = tubeRack({ ...board, rows: [3, 2] });
  expect(wide.halfWidth).toBeGreaterThan(tubeRack(board).halfWidth);
  expect(wide.front - wide.back).toBeLessThan(tubeRack(board).front - tubeRack(board).back);
  for (const rows of [[], [1, 2], [0, 5], [2.5, 2.5], [6]]) {
    expect(() => tubeRack({ ...board, rows })).toThrow();
  }
});

it('clears rims with the entire airborne marble on diagonal moves across the middle tube', async () => {
  const { rackFlightAcross, rackFlightHeight } = await import('../../src/engine/rack-flight');
  const rack = tubeRack(TUBE_BOARDS.find(board => board.id === 'tube-41')!);
  const from = rack.places[0]!, to = rack.places[4]!, middle = rack.places[2]!;
  const rim = .9 + 4 * 1.02;
  const radius = .49 * 1.18;
  for (const fromY of [1.25, 4.31]) for (const toY of [1.25, 4.31]) {
    const control = rackFlightHeight(fromY, toY, rim + .9);
    for (let step = 1; step < 200; step++) {
      const u = step / 200, v = 1 - u, across = rackFlightAcross(u);
      if (across === 0 || across === 1) continue;
      const x = from.x + (to.x - from.x) * across, z = from.z + (to.z - from.z) * across;
      const y = v ** 3 * fromY + 3 * v * u * control + u ** 3 * toY;
      for (const at of [from, middle, to]) {
        if (Math.hypot(x - at.x, z - at.z) <= .74 + radius) expect(y - radius).toBeGreaterThan(rim + .07);
      }
    }
  }
});
