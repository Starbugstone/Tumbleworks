import { LOOP_BOARDS } from '../src/loop/boards';
import { LoopRules } from '../src/loop/rules';
import { loopTree } from '../src/loop/solver';
import type { Color } from '../src/sim/types';

for (const board of LOOP_BOARDS) {
  const totals = new Map<Color, number>();
  let marbles = 0;
  for (const lane of board.lanes) for (const truck of lane) for (const s of truck.segments) { totals.set(s.color, (totals.get(s.color) ?? 0) + s.count); marbles += s.count; }
  for (const s of board.loop) { totals.set(s.color, (totals.get(s.color) ?? 0) + s.count); marbles += s.count; }
  const trucks = board.lanes.reduce((n, lane) => n + lane.length, 0);
  console.log(board.id, `trucks ${trucks} marbles ${marbles}/${trucks * board.truckCapacity}`, JSON.stringify(Object.fromEntries(totals)));
  try {
    const started = Date.now();
    const tree = loopTree(new LoopRules(board));
    console.log('   ', `cap ${board.loopCapacity}`, JSON.stringify(tree), `${Date.now() - started}ms`);
  } catch (error) { console.log('    ERROR', String(error)); }
}
