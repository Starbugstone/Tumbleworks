import { FUNNEL_WITNESSES } from '../tests/witnesses';
import { BOARDS } from '../src/sim/boards';
import { initPhysics, Machine } from '../src/machine/machine';
import type { BoardDef } from '../src/sim/types';

await initPhysics();
function brisk(board: BoardDef, order: string): { seconds: number; status: string; recoveries: Machine['recoveries']; occupancyMax: number; last: string } {
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
const ids = process.argv.slice(2);
for (const board of BOARDS.filter((board) => !ids.length || ids.includes(board.id))) {
  const outcome = brisk(board, FUNNEL_WITNESSES[board.id] ?? '');
  console.log(board.id, JSON.stringify(outcome));
  const recoveries = outcome.recoveries;
  if (outcome.status !== 'won' || recoveries.nudges + recoveries.teleports + recoveries.bounces !== 0) process.exitCode = 1;
}
