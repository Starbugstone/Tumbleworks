import { ConveyorSim } from '../../src/sim/conveyor';
import type { BoardDef, SimConfig, SimEvent } from '../../src/sim/types';

/** Drive the real tick implementation until only non-deliverable belt marbles remain. */
export function settle(sim: ConveyorSim, afterTick?: (events: SimEvent[]) => void): void {
  // Each remaining marble can require a full revolution, plus one entry step.
  // This deliberately generous finite bound also catches a broken delivery gate.
  const bound = (sim.occupancy + 1) * (sim.config.beltPositions + 1) * sim.config.ticksPerStep;
  let ticks = 0;
  while (
    sim.state.pending.length > 0 ||
    sim.state.belt.some((marble) => marble.color === sim.frontColor)
  ) {
    if (ticks++ >= bound) {
      throw new Error(`Simulation failed to settle within ${bound} ticks: ${JSON.stringify(sim.state)}`);
    }
    const events = sim.tick();
    afterTick?.(events);
  }
}

export function replaySettled(board: BoardDef, sequence: readonly number[], config?: SimConfig): ConveyorSim {
  const sim = new ConveyorSim(board, config);
  for (const supply of sequence) {
    const result = sim.release(supply);
    if (!result.ok) {
      throw new Error(`Settled replay rejected ${sequence.join(',')} at supply ${supply}: ${result.reason}`);
    }
    settle(sim);
  }
  return sim;
}

export interface TapTree {
  wins: string[];
  jams: string[];
}

export function enumerate(board: BoardDef): TapTree {
  const tree: TapTree = { wins: [], jams: [] };
  function visit(sequence: number[]): void {
    const sim = replaySettled(board, sequence);
    const label = sequence.map((supply) => String.fromCharCode(65 + supply)).join('');
    if (sim.state.status === 'won') {
      tree.wins.push(label);
      return;
    }
    if (sim.state.status === 'jammed') {
      tree.jams.push(label);
      return;
    }
    let branches = 0;
    for (let supply = 0; supply < board.supplies.length; supply += 1) {
      const branch = replaySettled(board, sequence);
      const result = branch.release(supply);
      if (!result.ok) continue;
      branches += 1;
      const next = [...sequence, supply];
      // Jam sequences stop at the release which first changes status, even
      // though the presentation will continue ticking its pending marbles in.
      if (branch.state.status === 'jammed') {
        tree.jams.push(next.map((index) => String.fromCharCode(65 + index)).join(''));
      } else {
        visit(next);
      }
    }
    if (branches === 0) throw new Error(`Playing state has no accepted release: ${label}`);
  }
  visit([]);
  tree.wins.sort();
  tree.jams.sort();
  return tree;
}
