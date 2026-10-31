import type { MachineRules } from '../../src/sim/rules';
import type { BoardDef, Color, Packet } from '../../src/sim/types';

export function board(
  supplies: readonly (readonly Packet[])[], boxes: readonly Color[], beltCapacity = 3, boxSize = 1,
): BoardDef {
  return { id: 'fixture', title: 'Fixture', supplies, boxes, beltCapacity, boxSize };
}

export function packet(color: Color, count = 1): Packet {
  return { color, count };
}

export function colorCounts(colors: readonly Color[]): Record<Color, number> {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const color of colors) counts[color] += 1;
  return counts;
}

/** Bookkeeping independently reconstructed from the board, not the implementation's state. */
export function invariantChecker(rules: MachineRules): () => void {
  const identities = rules.board.supplies.flatMap((supply) => supply.flatMap((value) =>
    Array.from({ length: value.count }, () => value.color),
  ));
  const initialColors = colorCounts(identities);
  let terminal: 'won' | 'jammed' | undefined;
  return () => {
    const { state, board } = rules;
    function require(condition: boolean, message: string): asserts condition {
      if (!condition) throw new Error(`${message}: ${JSON.stringify(state)}`);
    }
    const ids = state.marbles.map((marble) => marble.id);
    require(ids.length === identities.length && new Set(ids).size === identities.length, 'Missing or duplicate IDs');
    for (const [index, marble] of state.marbles.entries()) {
      require(marble.id === index && marble.color === identities[index], 'Changed marble identity');
    }
    const unreleased = state.supplies.flatMap((supply) => supply.flatMap((value) => {
      require(value.marbles.every((marble) => marble.color === value.color), 'Changed packet colour');
      return value.marbles;
    }));
    const remaining = state.marbles.filter((marble) => marble.status !== 'in-supply');
    const locations = [...unreleased, ...remaining];
    require(locations.length === identities.length, 'Marbles not conserved across locations');
    require(new Set(locations.map((marble) => marble.id)).size === identities.length, 'Duplicate locations');
    for (const marble of unreleased) {
      require(state.marbles[marble.id]?.status === 'in-supply', 'Released marble still in supply');
      require(identities[marble.id] === marble.color, 'Changed supply identity');
    }
    const counts = colorCounts(locations.map((marble) => marble.color));
    for (const color of ['red', 'blue', 'green', 'yellow'] as const) {
      require(counts[color] === initialColors[color], `Lost ${color} marbles`);
    }
    const occupancy = state.marbles.filter((marble) => marble.status === 'on-belt').length;
    require(rules.occupancy === occupancy && occupancy <= board.beltCapacity && occupancy >= 0, 'Invalid occupancy');
    require(rules.free === board.beltCapacity - occupancy, 'Invalid free capacity');
    const pending = state.marbles.filter((marble) => marble.status === 'pouring').map((marble) => marble.id).sort((a, b) => a - b);
    require(new Set(state.pending).size === state.pending.length, 'Duplicate funnel identities');
    require(JSON.stringify([...state.pending].sort((a, b) => a - b)) === JSON.stringify(pending), 'Funnel queue loses a pouring marble');
    require(rules.funnelCount === pending.length, 'Invalid funnel count');
    require(Number.isInteger(rules.activeBox) && rules.activeBox >= 0 && rules.activeBox <= board.boxes.length, 'Invalid box');
    require(rules.activeFill >= 0 && rules.activeFill <= board.boxSize, 'Invalid fill');
    require(rules.activeColor === (board.boxes[rules.activeBox] ?? null), 'Invalid active colour');
    let captured = 0;
    for (let boxIndex = 0; boxIndex < board.boxes.length; boxIndex += 1) {
      const reserved = state.marbles.filter((marble) => marble.boxIndex === boxIndex);
      require(reserved.length <= board.boxSize, 'Over-reserved box');
      require(new Set(reserved.map((marble) => marble.slot)).size === reserved.length, 'Duplicate slots');
      for (const marble of reserved) {
        require(marble.status === 'dropping' || marble.status === 'in-box', 'Non-delivery reserved a slot');
        require(marble.color === board.boxes[boxIndex], 'Wrong colour delivered');
        require(Number.isInteger(marble.slot) && marble.slot >= 0 && marble.slot < board.boxSize, 'Invalid slot');
      }
      const inBox = reserved.filter((marble) => marble.status === 'in-box').length;
      captured += inBox;
      if (boxIndex < rules.activeBox) require(inBox === board.boxSize, 'Swapped incomplete box');
      if (boxIndex === rules.activeBox) require(inBox === rules.activeFill, 'Fill differs from captures');
      if (boxIndex > rules.activeBox) require(reserved.length === 0, 'Reserved future box');
    }
    require(captured === rules.activeBox * board.boxSize + rules.activeFill, 'Capture count differs from progress');
    for (const marble of state.marbles) {
      if (marble.status === 'dropping' || marble.status === 'in-box') {
        require(marble.boxIndex >= 0 && marble.boxIndex < board.boxes.length, 'Delivery without box');
        if (marble.status === 'dropping') require(marble.boxIndex === rules.activeBox, 'Drop into inactive box');
      } else {
        require(marble.boxIndex === null && marble.slot === null, 'Belt/supply marble has a reservation');
      }
    }
    require(state.waitingForSwap === (rules.activeBox < board.boxes.length && rules.activeFill === board.boxSize), 'Invalid swap flag');
    if (rules.status === 'jammed') {
      require(!state.waitingForSwap && !state.marbles.some((marble) => marble.status === 'dropping'), 'Premature jam');
      require(!state.marbles.some((marble) =>
        marble.status === 'on-belt' && marble.color === rules.activeColor,
      ), 'Jammed with deliverable marble');
      require(occupancy === board.beltCapacity, 'Jammed before the belt is full');
    }
    if (rules.status === 'won') {
      require(unreleased.length === 0 && occupancy === 0 && state.pending.length === 0 && !state.marbles.some((marble) => marble.status === 'dropping'), 'Premature win');
      require(rules.activeBox === board.boxes.length && rules.activeFill === 0, 'Won before all swaps');
    }
    if (terminal !== undefined) require(rules.status === terminal, 'Terminal status changed');
    if (rules.status !== 'playing') terminal = rules.status;
  };
}
