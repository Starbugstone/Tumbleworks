import { LOOP_BOARDS } from '../src/loop/boards';
import { LoopMachine } from '../src/loop/machine';
import type { LoopBoardDef } from '../src/loop/types';

import { LOOP_WITNESSES as WITNESSES } from '../tests/witnesses';
function play(board: LoopBoardDef, order: string): Record<string, unknown> {
  const machine = new LoopMachine(board);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  let most = 0;
  let rejected = 0;
  for (let tick = 0; tick < 60 * 200; tick++) {
    machine.step();
    most = Math.max(most, machine.rules.occupancy);
    if (machine.rules.status !== 'playing' && !machine.transferring) break;
    const tap = taps[next];
    if (tap !== undefined && machine.rules.pending === 0 && !machine.rules.canDrain() && tick % 10 === 0) {
      const result = machine.tap(tap);
      if (result.ok) next += 1; else rejected += 1;
    }
  }
  return { seconds: machine.tick / 60, status: machine.rules.status, most, cap: board.loopCapacity, tapsDone: next, rejected, busy: machine.transferring };
}
for (const board of LOOP_BOARDS) console.log(board.id, JSON.stringify(play(board, WITNESSES[board.id] ?? '')));
