import { ConveyorSim } from '../../src/sim/conveyor';
import type { BoardDef, Color, Packet, SimConfig, SimEvent } from '../../src/sim/types';

export const FAST_CONFIG: SimConfig = {
  beltPositions: 6,
  entryPosition: 0,
  deliveryPosition: 3,
  ticksPerStep: 2,
};

export function board(
  supplies: readonly (readonly Packet[])[],
  boxes: readonly Color[],
  beltCapacity = 3,
  boxSize = 1,
): BoardDef {
  return { id: 'fixture', title: 'Fixture', supplies, boxes, beltCapacity, boxSize };
}

export function packet(color: Color, count = 1): Packet {
  return { color, count };
}

export function tick(sim: ConveyorSim, count: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let index = 0; index < count; index += 1) events.push(...sim.tick());
  return events;
}

export function colorCounts(colors: readonly Color[]): Record<Color, number> {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const color of colors) counts[color] += 1;
  return counts;
}

/** Independent bookkeeping, including delivered colours and unreleased IDs. */
export function invariantChecker(sim: ConveyorSim): () => void {
  const initial = sim.state.supplies.flatMap((supply) => supply.flatMap((value) => value.marbles));
  const initialColors = colorCounts(initial.map((marble) => marble.color));
  const identities = new Map(initial.map((marble) => [marble.id, marble.color]));
  return () => {
    const { state } = sim;
    const remaining = [
      ...state.supplies.flatMap((supply) => supply.flatMap((value) => value.marbles)),
      ...state.pending,
      ...state.belt,
    ];
    function require(condition: boolean, message: string): void {
      if (!condition) throw new Error(`${message} at tick ${state.tick}: ${JSON.stringify(state)}`);
    }
    require(sim.occupancy <= sim.board.beltCapacity, 'Capacity exceeded');
    require(sim.occupancy >= 0 && sim.free === sim.board.beltCapacity - sim.occupancy, 'Invalid occupancy');
    require(new Set(state.belt.map((marble) => marble.position)).size === state.belt.length, 'Overlapping positions');
    require(new Set(remaining.map((marble) => marble.id)).size === remaining.length, 'Duplicate IDs');
    for (const marble of remaining) {
      require(identities.get(marble.id) === marble.color, 'Changed marble identity');
    }
    for (const marble of state.belt) {
      require(Number.isInteger(marble.position) && marble.position >= 0 && marble.position < sim.config.beltPositions, 'Invalid position');
    }
    require(Number.isInteger(state.tick) && state.tick >= 0, 'Invalid tick');
    require(Number.isInteger(state.stepTick) && state.stepTick >= 0 && state.stepTick < sim.config.ticksPerStep, 'Invalid phase');
    require(state.frontBox >= 0 && state.frontBox <= sim.board.boxes.length, 'Invalid front box');
    require(state.frontBoxFill >= 0 && state.frontBoxFill < sim.board.boxSize, 'Invalid box fill');
    require(remaining.length + state.frontBox * sim.board.boxSize + state.frontBoxFill === initial.length, 'Marbles not conserved');
    const counts = colorCounts(remaining.map((marble) => marble.color));
    for (let index = 0; index < state.frontBox; index += 1) {
      const color = sim.board.boxes[index];
      if (color !== undefined) counts[color] += sim.board.boxSize;
    }
    if (sim.frontColor !== null) counts[sim.frontColor] += state.frontBoxFill;
    for (const color of ['red', 'blue', 'green', 'yellow'] as const) {
      require(counts[color] === initialColors[color], `Colour ${color} not conserved`);
    }
  };
}
