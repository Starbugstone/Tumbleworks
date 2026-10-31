import { FUNNEL_WITNESSES } from '../tests/witnesses';
import { BOARDS } from '../src/sim/boards';
import { initPhysics, Machine } from '../src/machine/machine';
import type { BoardDef } from '../src/sim/types';

await initPhysics();
function brisk(board: BoardDef, order: string): { seconds: number; status: string; recoveries: unknown; occupancyMax: number; last: string } {
  const machine = new Machine(board);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  let occupancyMax = 0;
  for (let tick = 0; tick < 60 * 150; tick++) {
    machine.step();
    occupancyMax = Math.max(occupancyMax, machine.rules.occupancy);
    if (machine.rules.status !== 'playing' && !machine.transferring) break;
    const tap = taps[next];
    if (tap !== undefined && machine.rules.funnelCount === 0 && tick % 10 === 0 && machine.tap(tap).ok) next += 1;
  }
  const result = { seconds: machine.tick / 60, status: machine.rules.status, recoveries: machine.recoveries, occupancyMax, last: machine.lastRecovery };
  machine.world.free();
  return result;
}
BOARDS.forEach((board) => console.log(board.id, JSON.stringify(brisk(board, FUNNEL_WITNESSES[board.id] ?? ''))));
