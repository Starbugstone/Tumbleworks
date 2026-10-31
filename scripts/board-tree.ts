import { BOARDS } from '../src/sim/boards';
import { MachineRules } from '../src/sim/rules';
import { releaseTree } from '../src/sim/solver';
import type { Color } from '../src/sim/types';

for (const board of BOARDS) {
  const totals = new Map<Color, number>();
  for (const supply of board.supplies) for (const packet of supply) totals.set(packet.color, (totals.get(packet.color) ?? 0) + packet.count);
  const wanted = new Map<Color, number>();
  for (const color of board.docks.flat()) wanted.set(color, (wanted.get(color) ?? 0) + board.boxSize);
  const mismatch = [...new Set([...totals.keys(), ...wanted.keys()])].filter((color) => totals.get(color) !== wanted.get(color))
    .map((color) => `${color} supply ${totals.get(color) ?? 0} boxes ${wanted.get(color) ?? 0}`);
  if (mismatch.length) { console.log(board.id, 'MISMATCH', mismatch.join('; ')); continue; }
  const started = Date.now();
  const tree = releaseTree(new MachineRules(board), 60_000);
  const marbles = [...totals.values()].reduce((a, b) => a + b, 0);
  console.log(board.id, `cap ${board.beltCapacity}`, `marbles ${marbles}`, JSON.stringify(tree), `${Date.now() - started}ms`);
}
